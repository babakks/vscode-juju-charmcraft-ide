import { assert } from "chai";
import { suite, test } from "mocha";
import { Position, Range, TextPositionMapper, comparePositions, isInRange, toValidSymbol } from "../common";

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

suite(toValidSymbol.name, function () {
    type TestCase = {
        name: string;
        arg: string;
        expected: string;
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            arg: '',
            expected: '',
        }, {
            name: 'small caps',
            arg: 'abc',
            expected: 'abc',
        }, {
            name: 'mixed cases',
            arg: 'AbC',
            expected: 'AbC',
        }, {
            name: 'with dash',
            arg: 'a-b',
            expected: 'a_b',
        }, {
            name: 'with leading dash',
            arg: '-a-b',
            expected: '_a_b',
        }, {
            name: 'with trailing dash',
            arg: 'a-b-',
            expected: 'a_b_',
        },
    ];
    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.equal(toValidSymbol(tt.arg), tt.expected);
        });
    }
});

suite(TextPositionMapper.name, function () {
    suite('index/position mapping', function () {
        function _assert(name: string, content: string, index: number, position: Position) {
            test(name, function () {
                const sut = new TextPositionMapper(content);
                assert.deepStrictEqual(sut.indexToPosition(index), position, 'failed: index -> position');
                assert.deepStrictEqual(sut.positionToIndex(position), index, 'failed: position -> index');
            });
        }

        _assert('empty', '', 0, { line: 0, character: 0 });
        _assert('blank two lines (start, first line)', '\n', 0, { line: 0, character: 0 });
        _assert('blank two lines (right after end)', '\n', 1, { line: 1, character: 0 });
        _assert('blank three lines (start, first line)', '\n\n', 0, { line: 0, character: 0 });
        _assert('blank three lines (start, second line)', '\n\n', 1, { line: 1, character: 0 });
        _assert('blank three lines (right after end)', '\n\n', 2, { line: 2, character: 0 });
        _assert('one line (start)', 'text', 0, { line: 0, character: 0 });
        _assert('one line (middle)', 'text', 2, { line: 0, character: 2 });
        _assert('one line (end)', 'text', 3, { line: 0, character: 3 });
        _assert('one line (right after end)', 'text', 4, { line: 1, character: 0 });
        _assert('two lines (start, first line)', 'text\ntext', 0, { line: 0, character: 0 });
        _assert('two lines (start, second line)', 'text\ntext', 5, { line: 1, character: 0 });
        _assert('two lines (middle, first line)', 'text\ntext', 2, { line: 0, character: 2 });
        _assert('two lines (middle, second line)', 'text\ntext', 7, { line: 1, character: 2 });
        _assert('two lines (end, first line)', 'text\ntext', 3, { line: 0, character: 3 });
        _assert('two lines (end, second line)', 'text\ntext', 8, { line: 1, character: 3 });
        _assert('two lines (right after end)', 'text\ntext', 9, { line: 2, character: 0 });
        _assert('three lines, middle blank (start, second line)', 'text\n\ntext', 5, { line: 1, character: 0 });
        _assert('three lines, middle blank (start, third line)', 'text\n\ntext', 6, { line: 2, character: 0 });
    });

    suite(TextPositionMapper.prototype.all.name, function () {
        type TestCase = {
            name: string,
            content: string;
            expectedEnd: Position;
        };
        const tests: TestCase[] = [
            {
                name: 'empty',
                content: '',
                expectedEnd: { line: 0, character: 0 },
            }, {
                name: 'single character',
                content: '?',
                expectedEnd: { line: 1, character: 0 },
            }, {
                name: '\\n',
                content: '\n',
                expectedEnd: { line: 1, character: 0 },
            }, {
                name: '\\n\\n',
                content: '\n\n',
                expectedEnd: { line: 2, character: 0 },
            }, {
                name: 'two lines',
                content: 'a\nb',
                expectedEnd: { line: 2, character: 0 },
            },
        ];
        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                assert.deepStrictEqual(
                    new TextPositionMapper(tt.content).all(),
                    { start: { line: 0, character: 0 }, end: tt.expectedEnd }
                );
            });
        }
    });
});