<?php

use App\Services\DueDateService;
use Carbon\Carbon;

test('due day rule: move in 9 -> due 8, move in 15 -> due 14, move in 2 -> due 1', function () {
    expect(DueDateService::dueDay(9))->toBe(8);
    expect(DueDateService::dueDay(15))->toBe(14);
    expect(DueDateService::dueDay(2))->toBe(1);
});

test('due day rule: move in 1 never yields day 0, uses previous month last day', function () {
    expect(DueDateService::dueDay(1))->toBe(0);
    expect(DueDateService::dueDayOfMonth(Carbon::parse('2026-09-01'), 1))->toBe(31); // Aug 2026
    expect(DueDateService::dueDayOfMonth(Carbon::parse('2026-10-01'), 1))->toBe(30); // Sep 2026
    expect(DueDateService::dueDayOfMonth(Carbon::parse('2026-03-01'), 1))->toBe(28); // Feb 2026
});

test('next monthly due date follows the same day-rule for reminders', function () {
    Carbon::setTestNow(Carbon::parse('2026-09-05 10:00:00'));

    try {
        // move in 9 -> due 8th; next 8th after today (5 Sep 2026) is 8 Sep 2026
        expect(DueDateService::nextDueDate('2026-09-09', 9)->toDateString())->toBe('2026-09-08');
        // move in 15 -> due 14th; next 14th after 5 Sep is 14 Sep 2026
        expect(DueDateService::nextDueDate('2026-09-15', 15)->toDateString())->toBe('2026-09-14');
        // move in 2 -> due 1st; next 1st after 5 Sep is 1 Oct 2026
        expect(DueDateService::nextDueDate('2026-09-02', 2)->toDateString())->toBe('2026-10-01');
        // move in 1 -> end of month; next after 5 Sep is 30 Sep 2026
        expect(DueDateService::nextDueDate('2026-09-01', 1)->toDateString())->toBe('2026-09-30');
    } finally {
        Carbon::setTestNow(null);
    }
});