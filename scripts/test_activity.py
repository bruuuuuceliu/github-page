"""Regression tests for omitted private counts and inconsistent API responses."""
import copy
import json
import unittest
from datetime import date, timedelta
from unittest.mock import patch
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('activity', Path(__file__).with_name('update-activity.py'))
activity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(activity)

def calendar(start, end):
    days = []
    while start <= end:
        count = 11 if start == date(2025, 10, 11) else 0
        days.append({'date': start.isoformat(), 'contributionCount': count,
                     'contributionLevel': 'FOURTH_QUARTILE' if count else 'NONE'})
        start += timedelta(days=1)
    return {'totalContributions': sum(day['contributionCount'] for day in days),
            'weeks': [{'contributionDays': days}]}

class CalendarTests(unittest.TestCase):
    def setUp(self):
        self.years = {'2025': calendar(date(2025, 1, 1), date(2025, 12, 31)),
                      '2026': calendar(date(2026, 1, 1), date(2026, 10, 7))}
        self.last = calendar(date(2025, 10, 7), date(2026, 10, 7))

    def test_preserves_private_aggregate_and_exports_no_repo_details(self):
        data = activity.export(self.years, self.last)
        self.assertEqual(data['total'], 11)
        self.assertEqual(data['allTotal'], 11)
        self.assertEqual(next(d['count'] for d in data['allDays'] if d['date'] == '2025-10-11'), 11)
        self.assertEqual(data['scope'], 'account')
        self.assertEqual(set(data['allDays'][0]), {'date', 'count', 'level'})

    def test_rejects_disagreement_between_independent_period_queries(self):
        last = copy.deepcopy(self.last)
        last['weeks'][0]['contributionDays'][4]['contributionCount'] = 0
        last['totalContributions'] = 0
        with self.assertRaisesRegex(ValueError, 'disagree'):
            activity.export(self.years, last)

    def test_rejects_missing_date_and_mismatched_total(self):
        broken = copy.deepcopy(self.last)
        broken['weeks'][0]['contributionDays'].pop(10)
        with self.assertRaisesRegex(ValueError, 'Missing'):
            activity.validate_calendar(broken)
        broken = copy.deepcopy(self.last)
        broken['totalContributions'] += 1
        with self.assertRaisesRegex(ValueError, 'total'):
            activity.validate_calendar(broken)

    def test_requires_private_contribution_permission(self):
        response = unittest.mock.MagicMock()
        response.__enter__.return_value = response
        response.headers = {'X-OAuth-Scopes': 'repo, read:org, workflow'}
        with patch.object(activity, 'urlopen', return_value=response):
            with self.assertRaisesRegex(RuntimeError, 'read:user'):
                activity.fetch('test-token')

    def test_public_parser_uses_dates_and_counts_from_github_tooltips(self):
        parser = activity.PublicCalendarParser()
        parser.feed('<td id="a" data-date="2025-10-11" data-level="3"></td>'
                    '<tool-tip for="a">9 contributions on October 11th.</tool-tip>'
                    '<td id="b" data-date="2025-10-12" data-level="0"></td>'
                    '<tool-tip for="b">No contributions on October 12th.</tool-tip>')
        data = parser.calendar(2025, date(2026, 10, 7))
        self.assertEqual(data['totalContributions'], 9)
        self.assertEqual(activity.validate_calendar(data)[0]['count'], 9)

    def test_public_parser_rejects_missing_tooltip_instead_of_inventing_zero(self):
        parser = activity.PublicCalendarParser()
        parser.feed('<td id="a" data-date="2025-10-11" data-level="3"></td>')
        with self.assertRaisesRegex(ValueError, 'tooltip missing'):
            parser.calendar(2025, date(2026, 10, 7))

    def test_owner_token_with_read_user_is_accepted(self):
        import io
        response = io.BytesIO(json.dumps({'data': {'viewer': {'login': activity.LOGIN},
                                                 'user': {'createdAt': '2019-01-01T00:00:00Z'}}}).encode())
        response.headers = {'X-OAuth-Scopes': 'read:user'}
        with patch.object(activity, 'urlopen', return_value=response):
            self.assertIn('createdAt', activity.fetch('test-token'))

if __name__ == '__main__':
    unittest.main()
