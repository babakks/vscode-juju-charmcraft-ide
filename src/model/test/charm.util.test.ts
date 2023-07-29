import { suite, test } from "mocha";
import { assert } from 'chai';
import { comparePositions, isInRange } from "../util";
import { Position, Range } from "../type";

suite(comparePositions.name, function () {
    type TestCase = {
        name: string;
        a: Position;
        b: Position;
        expected: -1 | 0 | 1;
    };
    const tests: TestCase[] = [
        {
            name: 'a == b',
            a: { line: 0, character: 0 },
            b: { line: 0, character: 0 },
            expected: 0,
        }, {
            name: 'a == b (non-zero)',
            a: { line: 1, character: 1 },
            b: { line: 1, character: 1 },
            expected: 0,
        }, {
            name: 'a < b (same line)',
            a: { line: 0, character: 0 },
            b: { line: 0, character: 1 },
            expected: -1,
        }, {
            name: 'a < b',
            a: { line: 0, character: 0 },
            b: { line: 1, character: 0 },
            expected: -1,
        }
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.equal(comparePositions(tt.a, tt.b), tt.expected);
            assert.equal(comparePositions(tt.b, tt.a), -1 * tt.expected);
        });
    }
});

suite(isInRange.name, function () {
    const range = { start: { line: 10, character: 10 }, end: { line: 20, character: 20 } };
    type TestCase = {
        name: string;
        range: Range;
        position: Position;
        expected: boolean;
    };
    const tests: TestCase[] = [
        {
            name: 'x < start',
            range,
            position: { line: 9, character: 0 },
            expected: false,
        }, {
            name: 'x < start (same line)',
            range,
            position: { line: 10, character: 9 },
            expected: false,
        }, {
            name: 'x == start',
            range,
            position: { line: 10, character: 10 },
            expected: true,
        }, {
            name: 'in range (same line as start)',
            range,
            position: { line: 10, character: 11 },
            expected: true,
        }, {
            name: 'in range',
            range,
            position: { line: 15, character: 15 },
            expected: true,
        }, {
            name: 'in range (same line as end)',
            range,
            position: { line: 20, character: 19 },
            expected: true,
        }, {
            name: 'end == x',
            range,
            position: { line: 20, character: 20 },
            expected: false,
        }, {
            name: 'end < x (same line)',
            range,
            position: { line: 20, character: 21 },
            expected: false,
        }, {
            name: 'end < x',
            range,
            position: { line: 21, character: 0 },
            expected: false,
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.equal(isInRange(tt.position, tt.range), tt.expected);
        });
    }
});