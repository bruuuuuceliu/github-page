"""Export account-wide contribution counts via GitHub's authenticated GraphQL API.

Credentials stay in the local CLI or Actions secret. Only aggregate counts and dates
are written to the site. Refuse tokens missing read:user instead of silently dropping
private/internal contributions.
"""
import argparse
import json
import os
import subprocess
import re
from html.parser import HTMLParser
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

LOGIN = 'bruuuuuceliu'
SOURCE = 'https://api.github.com/graphql'
LEVELS = {'NONE': 0, 'FIRST_QUARTILE': 1, 'SECOND_QUARTILE': 2,
          'THIRD_QUARTILE': 3, 'FOURTH_QUARTILE': 4}
QUERY = '''query($login:String!, $from:DateTime, $to:DateTime) {
  viewer { login }
  user(login:$login) {
    createdAt
    contributionsCollection(from:$from, to:$to) {
      contributionYears
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}'''

def validate_calendar(calendar):
    days = sorted([{'date': day['date'], 'count': day['contributionCount'],
                    'level': LEVELS[day['contributionLevel']]}
                   for week in calendar['weeks'] for day in week['contributionDays']],
                  key=lambda day: day['date'])
    for day in days:
        date.fromisoformat(day['date'])
        if type(day['count']) is not int or day['count'] < 0:
            raise ValueError('Invalid contribution count')
    if not days or len({day['date'] for day in days}) != len(days):
        raise ValueError('Empty or duplicate calendar')
    if (date.fromisoformat(days[-1]['date']) - date.fromisoformat(days[0]['date'])).days + 1 != len(days):
        raise ValueError('Missing calendar dates')
    if sum(day['count'] for day in days) != calendar['totalContributions']:
        raise ValueError('Contribution total does not match daily counts')
    return days

def export(year_calendars, last_calendar, scope='account'):
    all_days, totals = [], {}
    for year, calendar in sorted(year_calendars.items()):
        days = validate_calendar(calendar)
        if any(not day['date'].startswith(str(year) + '-') for day in days):
            raise ValueError('Calendar spans the wrong year')
        all_days.extend(days)
        totals[str(year)] = calendar['totalContributions']
    days = validate_calendar(last_calendar)
    if len(days) < 365:
        raise ValueError('Incomplete past-year calendar')
    by_date = {day['date']: day['count'] for day in all_days}
    if any(by_date.get(day['date']) != day['count'] for day in days):
        raise ValueError('Year and past-year counts disagree; retry sync')
    return {'source': SOURCE if scope == 'account' else 'https://github.com/users/' + LOGIN + '/contributions', 'scope': scope, 'profile': 'https://github.com/' + LOGIN,
            'updatedAt': datetime.now(timezone.utc).isoformat(),
            'total': last_calendar['totalContributions'], 'allTotal': sum(totals.values()),
            'totals': totals, 'days': days, 'allDays': all_days}

def fetch(token, start=None, end=None):
    body = json.dumps({'query': QUERY, 'variables': {'login': LOGIN, 'from': start, 'to': end}}).encode()
    request = Request(SOURCE, data=body, headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
        'User-Agent': 'Bruce-Liu-project-page'})
    with urlopen(request, timeout=30) as response:
        scopes = {scope.strip() for scope in response.headers.get('X-OAuth-Scopes', '').split(',')}
        if not ({'read:user', 'user'} & scopes):
            raise RuntimeError('GitHub authorization needs read:user to include private/internal contributions. '
                               'Run gh auth refresh -h github.com -s read:user, or configure ACTIVITY_TOKEN.')
        payload = json.load(response)
    if payload.get('errors'):
        raise RuntimeError('GitHub rejected the contribution query')
    data = payload['data']
    if data['viewer']['login'].lower() != LOGIN.lower():
        raise RuntimeError('Use the profile owner’s token for complete account counts')
    return data['user']

def sync(token):
    today = datetime.now(ZoneInfo('Asia/Shanghai')).date()
    try:
        start = today.replace(year=today.year - 1)
    except ValueError:  # February 29 becomes February 28 in a non-leap year.
        start = today.replace(year=today.year - 1, day=28)
    user = fetch(token, start.isoformat() + 'T00:00:00Z', today.isoformat() + 'T23:59:59Z')
    years = range(int(user['createdAt'][:4]), today.year + 1)
    calendars = {}
    for year in years:
        end = f'{year}-12-31T23:59:59Z' if year < today.year else today.isoformat() + 'T23:59:59Z'
        result = fetch(token, f'{year}-01-01T00:00:00Z', end)
        calendars[year] = result['contributionsCollection']['contributionCalendar']
    return export(calendars, user['contributionsCollection']['contributionCalendar'])

class PublicCalendarParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cells, self.counts = {}, {}
        self.tooltip, self.tooltip_text = None, ''

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('data-date') and attrs.get('data-level') is not None:
            self.cells[attrs['id']] = (attrs['data-date'], int(attrs['data-level']))
        if tag == 'tool-tip':
            self.tooltip, self.tooltip_text = attrs.get('for'), ''

    def handle_data(self, text):
        if self.tooltip:
            self.tooltip_text += text

    def handle_endtag(self, tag):
        if tag == 'tool-tip' and self.tooltip:
            match = re.match(r'(No|[\d,]+) contributions? on ', self.tooltip_text.strip())
            if match:
                self.counts[self.tooltip] = 0 if match[1] == 'No' else int(match[1].replace(',', ''))
            self.tooltip = None

    def calendar(self, year, today):
        days = []
        for cell, (day, level) in self.cells.items():
            if day.startswith(str(year) + '-') and day <= today.isoformat():
                if cell not in self.counts:
                    raise ValueError('GitHub calendar tooltip missing')
                days.append({'date': day, 'contributionCount': self.counts[cell],
                             'contributionLevel': list(LEVELS)[level]})
        return {'totalContributions': sum(day['contributionCount'] for day in days),
                'weeks': [{'contributionDays': days}]}

def sync_public():
    today = datetime.now(ZoneInfo('Asia/Shanghai')).date()
    try:
        start = today.replace(year=today.year - 1)
    except ValueError:
        start = today.replace(year=today.year - 1, day=28)
    calendars = {}
    # Only the two years needed for the rolling window. GitHub returns whole calendar years.
    for year in range(start.year, today.year + 1):
        url = f'https://github.com/users/{LOGIN}/contributions?from={year}-12-01&to={year}-12-31'
        request = Request(url, headers={'User-Agent': 'Bruce-Liu-project-page', 'Accept-Language': 'en'})
        with urlopen(request, timeout=30) as response:
            parser = PublicCalendarParser()
            parser.feed(response.read().decode())
        calendar = parser.calendar(year, today)
        days = validate_calendar(calendar)
        if days[0]['date'] != f'{year}-01-01' or days[-1]['date'] != min(date(year, 12, 31), today).isoformat():
            raise ValueError('GitHub returned an incomplete calendar year')
        calendars[str(year)] = calendar
    recent = [day for calendar in calendars.values() for week in calendar['weeks']
              for day in week['contributionDays'] if start.isoformat() <= day['date'] <= today.isoformat()]
    last = {'totalContributions': sum(day['contributionCount'] for day in recent),
            'weeks': [{'contributionDays': recent}]}
    return export(calendars, last, scope='public')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, help='Offline fixture with years and last calendars')
    parser.add_argument('--public', action='store_true', help='Sync public counts directly from GitHub without a token')
    options = parser.parse_args()
    if options.input:
        fixture = json.loads(options.input.read_text())
        data = export(fixture['years'], fixture['last'])
    elif options.public:
        data = sync_public()
    else:
        token = os.environ.get('ACTIVITY_TOKEN') or os.environ.get('GH_TOKEN')
        if not token:
            try:
                token = subprocess.check_output(['gh', 'auth', 'token'], text=True, stderr=subprocess.DEVNULL).strip()
            except (FileNotFoundError, subprocess.CalledProcessError):
                token = None
        data = sync(token) if token else sync_public()
    root = Path(__file__).resolve().parents[1]
    serialized = json.dumps(data, ensure_ascii=False)
    # Write only after every response and cross-check passes, preserving the old snapshot on failure.
    (root / 'site/activity-data.js').write_text('window.githubActivity = ' + serialized + ';\n')
    (root / 'site/activity.json').write_text(serialized + '\n')
    print(f"Saved {len(data['allDays'])} days; {data['allTotal']} all-time, {data['total']} past-year contributions")
