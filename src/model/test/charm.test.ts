import { assert } from "chai";
import { suite, test } from "mocha";
import { TextDecoder } from "util";
import {
    CharmClassMethod,
    CharmSourceCodeFileAnalyzer,
    DeepSearchCallback,
    DeepSearchCallbackNode,
    deepSearch,
    deepSearchForPattern,
    getNodeExtendedRange,
    getNodeRange,
    getTextOverRange,
    unquoteSymbol
} from "../charm";
import { Range } from "../common";
import path = require('path');
import { readFileSync } from "fs";

suite(CharmSourceCodeFileAnalyzer.name, function () {
    function makeSUT(fixtureName: string): CharmSourceCodeFileAnalyzer {
        const base = path.join(__dirname, '../../../resource/test/ast');
        const content = new TextDecoder().decode(readFileSync(path.join(base, fixtureName + '.py')));
        const ast = JSON.parse(new TextDecoder().decode(readFileSync(path.join(base, fixtureName + '.json'))));
        return new CharmSourceCodeFileAnalyzer(content, ast);
    }
    test('charm-01', function () {
        const sut = makeSUT('charm-01');

        assert.isDefined(sut.charmClasses);
        assert.isDefined(sut.mainCharmClass);
        assert.equal(sut.mainCharmClass!.name, 'CharmWithEventHandlers');

        const cs0 = sut.charmClasses![0];
        assert.isDefined(cs0);
        assert.equal(cs0.name, 'CharmWithEventHandlers');
        assert.equal(cs0.base, 'CharmBase');
        assert.deepStrictEqual(cs0.range, { start: { line: 7, character: 0 }, end: { line: 17, character: 12 } });
        assert.deepStrictEqual(cs0.extendedRange, { start: { line: 7, character: 0 }, end: { line: 19, character: 0 } });
        assert.deepStrictEqual(cs0.methods, [
            { name: '__init__', kind: 'method', isStatic: false, positionalParameters: ['self'], range: { start: { line: 8, character: 4 }, end: { line: 11, character: 79 } }, extendedRange: { start: { line: 8, character: 4 }, end: { line: 13, character: 0 } } },
            { name: '_on_start', kind: 'method', isStatic: false, positionalParameters: ['self', 'event'], range: { start: { line: 13, character: 4 }, end: { line: 14, character: 12 } }, extendedRange: { start: { line: 13, character: 4 }, end: { line: 16, character: 0 } } },
            { name: '_on_config_changed', kind: 'method', isStatic: false, positionalParameters: ['self', 'event'], range: { start: { line: 16, character: 4 }, end: { line: 17, character: 12 } }, extendedRange: { start: { line: 16, character: 4 }, end: { line: 19, character: 0 } } },
        ] satisfies CharmClassMethod[]);

        const cs1 = sut.charmClasses![1];
        assert.isDefined(cs1);
        assert.equal(cs1.name, 'CharmWithProperties');
        assert.equal(cs1.base, 'CharmBase');
        assert.deepStrictEqual(cs1.range, { start: { line: 19, character: 0 }, end: { line: 29, character: 12 } });
        assert.deepStrictEqual(cs1.extendedRange, { start: { line: 19, character: 0 }, end: { line: 31, character: 0 } });
        assert.deepStrictEqual(cs1.methods, [
            { name: '__init__', kind: 'method', isStatic: false, positionalParameters: ['self'], range: { start: { line: 20, character: 4 }, end: { line: 21, character: 31 } }, extendedRange: { start: { line: 20, character: 4 }, end: { line: 23, character: 0 } } },
            { name: 'some_property', kind: 'getter', isStatic: false, positionalParameters: ['self'], range: { start: { line: 24, character: 4 }, end: { line: 25, character: 12 } }, extendedRange: { start: { line: 24, character: 4 }, end: { line: 27, character: 0 } } },
            { name: 'some_property', kind: 'setter', isStatic: false, positionalParameters: ['self', 'value'], range: { start: { line: 28, character: 4 }, end: { line: 29, character: 12 } }, extendedRange: { start: { line: 28, character: 4 }, end: { line: 31, character: 0 } } },
        ] satisfies CharmClassMethod[]);

        const cs2 = sut.charmClasses![2];
        assert.isDefined(cs2);
        assert.equal(cs2.name, 'CharmWithStaticMethods');
        assert.equal(cs2.base, 'CharmBase');
        assert.deepStrictEqual(cs2.range, { start: { line: 31, character: 0 }, end: { line: 37, character: 12 } });
        assert.deepStrictEqual(cs2.extendedRange, { start: { line: 31, character: 0 }, end: { line: 39, character: 0 } });
        assert.deepStrictEqual(cs2.methods, [
            { name: 'static_method', kind: 'method', isStatic: true, positionalParameters: [], range: { start: { line: 32, character: 4 }, end: { line: 33, character: 12 } }, extendedRange: { start: { line: 32, character: 4 }, end: { line: 35, character: 0 } } },
            { name: 'static_method_with_decorator', kind: 'method', isStatic: true, positionalParameters: ['param'], range: { start: { line: 36, character: 4 }, end: { line: 37, character: 12 } }, extendedRange: { start: { line: 36, character: 4 }, end: { line: 39, character: 0 } } },
        ] satisfies CharmClassMethod[]);
    });
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
    const defaultNode = {
        /* eslint-disable */
        lineno: "1",
        col_offset: "0",
        end_lineno: "2",
        end_col_offset: "10"
        /* eslint-enable */
    };
    type TestCase = {
        name: string;
        node: any;
        nextNode: any;
        expected: Range;
    };
    /* eslint-disable */
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
    /* eslint-enable */

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