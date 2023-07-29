import { assert } from 'chai';
import { suite, test } from 'mocha';
import { Position, Range } from '../type';
import {
    DeepSearchCallback,
    DeepSearchCallbackNode,
    comparePositions,
    deepSearch,
    deepSearchForPattern,
    getNodeExtendedRange,
    getNodeRange,
    getTextOverRange,
    isInRange,
    toValidSymbol,
    unquoteSymbol
} from '../util';

test(toValidSymbol.name, function () {
    assert.equal(toValidSymbol(''), '');
    assert.equal(toValidSymbol('abc'), 'abc');
    assert.equal(toValidSymbol('AbC'), 'AbC');
    assert.equal(toValidSymbol('a-b'), 'a_b');
    assert.equal(toValidSymbol('-a-b'), '_a_b');
});

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

suite(getNodeRange.name, function () {
    test('returns zero-based line numbers', function () {
        assert.deepEqual(
            // eslint-disable-next-line @typescript-eslint/naming-convention
            getNodeRange({ lineno: "1", col_offset: "10", end_lineno: "100", end_col_offset: "1000" }),
            { start: { line: 0, character: 10 }, end: { line: 99, character: 1000 } }
        );
    });
});

suite(getNodeExtendedRange.name, function () {
    const defaultNode = { lineno: "1", col_offset: "0", end_lineno: "2", end_col_offset: "10" };
    type TestCase = {
        name: string;
        node: any;
        nextNode: any;
        expected: Range;
    };
    const tests: TestCase[] = [
        {
            name: 'undefined nextNode',
            node: defaultNode,
            nextNode: undefined,
            expected: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
        }, {
            name: 'node adjacent to nextNode (node end == nextNode start)',
            node: defaultNode,
            nextNode: { lineno: "2", col_offset: "10", end_lineno: "999", end_col_offset: "999" },
            expected: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
        }, {
            name: 'nextNode on node end line (node end < nextNode start)',
            node: defaultNode,
            nextNode: { lineno: "2", col_offset: "11", end_lineno: "999", end_col_offset: "999" },
            expected: { start: { line: 0, character: 0 }, end: { line: 1, character: 11 } },
        }, {
            name: 'nextNode on next line',
            node: defaultNode,
            nextNode: { lineno: "3", col_offset: "0", end_lineno: "999", end_col_offset: "999" },
            expected: { start: { line: 0, character: 0 }, end: { line: 2, character: 0 } },
        }, {
            name: 'nextNode after next line (empty lines in-between)',
            node: defaultNode,
            nextNode: { lineno: "4", col_offset: "0", end_lineno: "999", end_col_offset: "999" },
            expected: { start: { line: 0, character: 0 }, end: { line: 3, character: 0 } },
        }, {
            name: 'nextNode includes one decorator',
            node: defaultNode,
            nextNode: { decorator_list: [{ lineno: "3", col_offset: "10", end_lineno: "4", end_col_offset: "0" }], lineno: "4", col_offset: "0", end_lineno: "999", end_col_offset: "999" },
            expected: { start: { line: 0, character: 0 }, end: { line: 2, character: 0 } },
        }, {
            name: 'nextNode includes more than one decorators',
            node: defaultNode,
            nextNode: { decorator_list: [{ lineno: "3", col_offset: "10", end_lineno: "4", end_col_offset: "0" }, { lineno: "4", col_offset: "10", end_lineno: "5", end_col_offset: "0" }], lineno: "5", col_offset: "0", end_lineno: "999", end_col_offset: "999" },
            expected: { start: { line: 0, character: 0 }, end: { line: 2, character: 0 } },
        }, {
            name: 'nextNode after next line, with one decorator (empty lines in-between)',
            node: defaultNode,
            nextNode: { decorator_list: [{ lineno: "4", col_offset: "10", end_lineno: "5", end_col_offset: "0" }], lineno: "5", col_offset: "0", end_lineno: "999", end_col_offset: "999" },
            expected: { start: { line: 0, character: 0 }, end: { line: 3, character: 0 } },
        }, {
            name: 'nextNode after next line, with more than one decorators (empty lines in-between)',
            node: defaultNode,
            nextNode: { decorator_list: [{ lineno: "4", col_offset: "10", end_lineno: "5", end_col_offset: "0" }, { lineno: "5", col_offset: "10", end_lineno: "6", end_col_offset: "0" }], lineno: "6", col_offset: "0", end_lineno: "999", end_col_offset: "999" },
            expected: { start: { line: 0, character: 0 }, end: { line: 3, character: 0 } },
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(getNodeExtendedRange(tt.node, tt.nextNode), tt.expected);
        });
    }

});

suite(unquoteSymbol.name, function () {
    test('unmatched quotes', function () {
        assert.equal(unquoteSymbol(''), '');
        assert.equal(unquoteSymbol(' '), ' ');
        assert.equal(unquoteSymbol('abc'), 'abc');
        assert.equal(unquoteSymbol('"abc'), '"abc');
        assert.equal(unquoteSymbol('abc"'), 'abc"');
        assert.equal(unquoteSymbol("'abc"), "'abc");
        assert.equal(unquoteSymbol("abc'"), "abc'");
        assert.equal(unquoteSymbol(`"abc'`), `"abc'`);
        assert.equal(unquoteSymbol(`'abc"`), `'abc"`);
    });

    test('matched quotes', function () {
        assert.equal(unquoteSymbol(`''`), ``);
        assert.equal(unquoteSymbol(`""`), ``);
        assert.equal(unquoteSymbol(`'abc'`), `abc`);
        assert.equal(unquoteSymbol(`"abc"`), `abc`);
    });
});

suite(getTextOverRange.name, function () {
    type TestCase = {
        name: string;
        lines: string[];
        range: Range;
        expected: string;
    };
    const tests: TestCase[] = [
        {
            name: 'empty lines',
            lines: [],
            range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
            expected: '',
        }, {
            name: 'start line > end line (empty lines)',
            lines: [],
            range: { start: { line: 1, character: 0 }, end: { line: 0, character: 0 } },
            expected: '',
        }, {
            name: 'start line > end line',
            lines: ['line 0', 'line 1'],
            range: { start: { line: 1, character: 0 }, end: { line: 0, character: 0 } },
            expected: '',
        }, {
            name: 'start character > end character (equal lines, empty lines)',
            lines: [],
            range: { start: { line: 0, character: 100 }, end: { line: 0, character: 0 } },
            expected: '',
        }, {
            name: 'start character > end character (equal lines)',
            lines: ['line 0', 'line 1'],
            range: { start: { line: 0, character: 100 }, end: { line: 0, character: 0 } },
            expected: '',
        }, {
            name: 'start line == end line',
            lines: ['some text here'],
            range: { start: { line: 0, character: 5 }, end: { line: 0, character: 9 } },
            expected: 'text',
        }, {
            name: 'start line < end line',
            lines: ['> line 0 <', '> line 1 <', '> end <'],
            range: { start: { line: 0, character: 2 }, end: { line: 2, character: 5 } },
            expected: 'line 0 <\n> line 1 <\n> end',
        }, {
            name: 'start character negative (same start/end lines)',
            lines: ['some text here'],
            range: { start: { line: 0, character: -99 }, end: { line: 0, character: 4 } },
            expected: 'some',
        }, {
            name: 'start line negative',
            lines: ['some text here'],
            range: { start: { line: -99, character: 0 }, end: { line: 0, character: 4 } },
            expected: 'some',
        }, {
            name: 'end character out of bound (same start/end lines)',
            lines: ['some text here'],
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 999 } },
            expected: 'some text here',
        }, {
            name: 'end lines exceeds out of bound',
            lines: ['some text here'],
            range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
            expected: 'some text here',
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.equal(getTextOverRange(tt.lines, tt.range), tt.expected);
        });
    }
});

suite(deepSearch.name, function () {
    type TestCase = {
        name: string;
        node: any;
        expectedCallbackArgs: {
            key: any;
            skipKey?: true;
            nodeKind: string;
            skipNodeKind?: true;
            nodeValue: any;
            skipNodeValue?: true
        }[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty object ({})',
            node: {},
            expectedCallbackArgs: [{ key: 0, nodeKind: 'object', nodeValue: {} }],
        }, {
            name: 'flat object ({a:0})',
            node: { a: 0 },
            expectedCallbackArgs: [{ key: 0, nodeKind: 'object', nodeValue: { a: 0 } }],
        }, {
            name: 'nested objects ({a:0,b:{c:0}})',
            node: { a: 0, b: { c: 0 } },
            expectedCallbackArgs: [
                { key: 0, nodeKind: 'object', nodeValue: { a: 0, b: { c: 0 } } },
                { key: 'b', nodeKind: 'object', nodeValue: { c: 0 } },
            ],
        }, {
            name: 'empty array ([])',
            node: [],
            expectedCallbackArgs: [{ key: 0, nodeKind: 'array', nodeValue: [] }],
        }, {
            name: 'flat array [0]',
            node: [0],
            expectedCallbackArgs: [{ key: 0, nodeKind: 'array', nodeValue: [0] }],
        }, {
            name: 'nested arrays [0,[1]]',
            node: [0, [1]],
            expectedCallbackArgs: [
                { key: 0, nodeKind: 'array', nodeValue: [0, [1]] },
                { key: 1, nodeKind: 'array', nodeValue: [1] },
            ],
        }, {
            name: 'nested empty object and array',
            node: [{}],
            expectedCallbackArgs: [
                { key: 0, nodeKind: 'array', nodeValue: [{}] },
                { key: 0, nodeKind: 'object', nodeValue: {} },
            ],
        }, {
            name: 'nested objects and arrays',
            node: [0, { a: 0, b: [{ c: 2 }] }],
            expectedCallbackArgs: [
                { key: 0, nodeKind: 'array', nodeValue: [0, { a: 0, b: [{ c: 2 }] }] },
                { key: 1, nodeKind: 'object', nodeValue: { a: 0, b: [{ c: 2 }] } },
                { key: 'b', nodeKind: 'array', nodeValue: [{ c: 2 }] },
                { key: 0, nodeKind: 'object', nodeValue: { c: 2 } },
            ]
        }
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            const expected = tt.expectedCallbackArgs.reverse();
            deepSearch(tt.node, function (key: any, node: DeepSearchCallbackNode): boolean | DeepSearchCallback {
                if (expected.length === 0) {
                    assert.fail('unexpected call of callback function');
                }
                const expectedArgs = expected.pop();
                if (!expectedArgs) {
                    return true;
                }
                if (!expectedArgs.skipKey) {
                    assert.deepEqual(key, expectedArgs.key, 'key does not match');
                }
                if (!expectedArgs.skipNodeKind) {
                    assert.deepEqual(node.kind, expectedArgs.nodeKind, 'node.kind does not match');
                }
                if (!expectedArgs.skipNodeValue) {
                    assert.deepEqual(node.value, expectedArgs.nodeValue, 'node.value does not match');
                }
                return true;
            });
        });
    }
});

suite(deepSearchForPattern.name, function () {
    deepSearchForPattern(
        [
            {
                name: 'john',
                attributes: [

                ]
            },
            {

            }
        ],
        [{}]
    );
});