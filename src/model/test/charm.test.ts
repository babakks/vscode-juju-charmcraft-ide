import { assert } from "chai";
import { readFileSync } from "fs";
import { suite, test } from "mocha";
import { TextDecoder } from "util";
import {
    CharmSourceCode,
    CharmSourceCodeFile,
    CharmSourceCodeFileAnalyzer,
    CharmSourceCodeTree,
    CharmSourceCodeTreeDirectoryEntry,
    CharmSourceCodeTreeFileEntry,
    CharmTestSourceCodeFileAnalyzer,
    DeepSearchCallback,
    DeepSearchCallbackNode,
    SourceCodeCharmTestClass,
    SourceCodeClass,
    SourceCodeFileAnalyzer,
    SourceCodeFunction,
    deepSearch,
    deepSearchForPattern,
    getNodeExtendedRange,
    getNodeRange,
    unquoteSymbol
} from "../charm";
import { Range } from "../common";
import path = require('path');

suite(CharmSourceCodeFileAnalyzer.name, function () {
    function makeSUT(fixtureName: string): CharmSourceCodeFileAnalyzer {
        const base = path.join(__dirname, '../../../resource/test/ast');
        const content = new TextDecoder().decode(readFileSync(path.join(base, fixtureName + '.py')));
        const ast = JSON.parse(new TextDecoder().decode(readFileSync(path.join(base, fixtureName + '.json'))));
        return new CharmSourceCodeFileAnalyzer(new SourceCodeFileAnalyzer(content, ast));
    }

    test('charm-01', function () {
        const sut = makeSUT('charm-01');

        assert.lengthOf(sut.charmClasses!, 3);
        assert.isDefined(sut.mainCharmClass);
        assert.equal(sut.mainCharmClass!.name, 'CharmWithEventHandlers');

        let counter = 0;
        let cs: SourceCodeClass;

        cs = sut.charmClasses![counter++];
        assert.isDefined(cs);
        assert.equal(cs.name, 'CharmWithEventHandlers');
        assert.deepStrictEqual(cs.bases, ['CharmBase']);
        assert.deepStrictEqual(cs.range, { start: { line: 7, character: 0 }, end: { line: 17, character: 12 } });
        assert.deepStrictEqual(cs.extendedRange, { start: { line: 7, character: 0 }, end: { line: 19, character: 0 } });
        assert.lengthOf(cs.methods, 3);
        assert.deepOwnInclude(cs.methods[0], { name: '__init__', kind: 'method', isStatic: false, positionalParameters: ['self'], range: { start: { line: 8, character: 4 }, end: { line: 11, character: 79 } }, extendedRange: { start: { line: 8, character: 4 }, end: { line: 13, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[1], { name: '_on_start', kind: 'method', isStatic: false, positionalParameters: ['self', 'event'], range: { start: { line: 13, character: 4 }, end: { line: 14, character: 12 } }, extendedRange: { start: { line: 13, character: 4 }, end: { line: 16, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[2], { name: '_on_config_changed', kind: 'method', isStatic: false, positionalParameters: ['self', 'event'], range: { start: { line: 16, character: 4 }, end: { line: 17, character: 12 } }, extendedRange: { start: { line: 16, character: 4 }, end: { line: 19, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);

        cs = sut.charmClasses![counter++];
        assert.isDefined(cs);
        assert.equal(cs.name, 'CharmWithProperties');
        assert.deepStrictEqual(cs.bases, ['CharmBase']);
        assert.deepStrictEqual(cs.range, { start: { line: 19, character: 0 }, end: { line: 29, character: 12 } });
        assert.deepStrictEqual(cs.extendedRange, { start: { line: 19, character: 0 }, end: { line: 31, character: 0 } });
        assert.lengthOf(cs.methods, 3);
        assert.deepOwnInclude(cs.methods[0], { name: '__init__', kind: 'method', isStatic: false, positionalParameters: ['self'], range: { start: { line: 20, character: 4 }, end: { line: 21, character: 31 } }, extendedRange: { start: { line: 20, character: 4 }, end: { line: 23, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[1], { name: 'some_property', kind: 'getter', isStatic: false, positionalParameters: ['self'], range: { start: { line: 24, character: 4 }, end: { line: 25, character: 12 } }, extendedRange: { start: { line: 24, character: 4 }, end: { line: 27, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[2], { name: 'some_property', kind: 'setter', isStatic: false, positionalParameters: ['self', 'value'], range: { start: { line: 28, character: 4 }, end: { line: 29, character: 12 } }, extendedRange: { start: { line: 28, character: 4 }, end: { line: 31, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);

        cs = sut.charmClasses![counter++];
        assert.isDefined(cs);
        assert.equal(cs.name, 'CharmWithStaticMethods');
        assert.deepStrictEqual(cs.bases, ['CharmBase']);
        assert.deepStrictEqual(cs.range, { start: { line: 31, character: 0 }, end: { line: 37, character: 12 } });
        assert.deepStrictEqual(cs.extendedRange, { start: { line: 31, character: 0 }, end: { line: 39, character: 0 } });
        assert.lengthOf(cs.methods, 2);
        assert.deepOwnInclude(cs.methods[0], { name: 'static_method', kind: 'method', isStatic: true, positionalParameters: [], range: { start: { line: 32, character: 4 }, end: { line: 33, character: 12 } }, extendedRange: { start: { line: 32, character: 4 }, end: { line: 35, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[1], { name: 'static_method_with_decorator', kind: 'method', isStatic: true, positionalParameters: ['param'], range: { start: { line: 36, character: 4 }, end: { line: 37, character: 12 } }, extendedRange: { start: { line: 36, character: 4 }, end: { line: 39, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
    });
});

suite(CharmTestSourceCodeFileAnalyzer.name, function () {
    function makeSUT(fixtureName: string): CharmTestSourceCodeFileAnalyzer {
        const base = path.join(__dirname, '../../../resource/test/ast');
        const content = new TextDecoder().decode(readFileSync(path.join(base, fixtureName + '.py')));
        const ast = JSON.parse(new TextDecoder().decode(readFileSync(path.join(base, fixtureName + '.json'))));
        return new CharmTestSourceCodeFileAnalyzer(new SourceCodeFileAnalyzer(content, ast));
    }

    test('charm-test-01-unittest', function () {
        const sut = makeSUT('charm-test-01-unittest');

        assert.isDefined(sut.testFunctions);
        assert.isEmpty(sut.testFunctions);

        assert.lengthOf(sut.testClasses!, 2);
        let counter = 0;
        let ts: SourceCodeCharmTestClass;

        ts = sut.testClasses![counter++];
        assert.isDefined(ts);
        assert.equal(ts.name, 'TestCharmOne');
        assert.deepStrictEqual(ts.bases, ['TestCase']);
        assert.deepStrictEqual(ts.dialect, 'unittest.TestCase');
        assert.deepStrictEqual(ts.range, { start: { line: 7, character: 0 }, end: { line: 12, character: 12 } });
        assert.deepStrictEqual(ts.extendedRange, { start: { line: 7, character: 0 }, end: { line: 14, character: 0 } });
        assert.lengthOf(ts.testMethods, 1);
        assert.deepOwnInclude(ts.testMethods[0], { name: 'test_something', kind: 'method', isStatic: false, positionalParameters: ['self'], range: { start: { line: 11, character: 4 }, end: { line: 12, character: 12 } }, extendedRange: { start: { line: 11, character: 4 }, end: { line: 14, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);

        ts = sut.testClasses![counter++];
        assert.isDefined(ts);
        assert.equal(ts.name, 'TestCharmTwo');
        assert.deepStrictEqual(ts.bases, ['TestCase']);
        assert.deepStrictEqual(ts.dialect, 'unittest.TestCase');
        assert.deepStrictEqual(ts.range, { start: { line: 14, character: 0 }, end: { line: 19, character: 12 } });
        assert.deepStrictEqual(ts.extendedRange, { start: { line: 14, character: 0 }, end: { line: 23, character: 0 } });
        assert.lengthOf(ts.testMethods, 1);
        assert.deepOwnInclude(ts.testMethods[0], { name: 'test_something', kind: 'method', isStatic: false, positionalParameters: ['self'], range: { start: { line: 18, character: 4 }, end: { line: 19, character: 12 } }, extendedRange: { start: { line: 18, character: 4 }, end: { line: 23, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
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

suite(CharmSourceCode.name, function () {
    function file(content: string = ''): CharmSourceCodeTreeFileEntry {
        return { kind: 'file', data: new CharmSourceCodeFile(content, {}, true) };
    }
    function dir(content: CharmSourceCodeTree): CharmSourceCodeTreeDirectoryEntry {
        return { kind: 'directory', data: content };
    }

    suite(CharmSourceCode.prototype.getFiles.name, function () {
        type TestCase = {
            name: string;
            tree: CharmSourceCodeTree;
            expected: [string, CharmSourceCodeFile][];
        };

        const tests: TestCase[] = [
            {
                name: 'empty',
                tree: {},
                expected: [],
            }, {
                name: 'no directories',
                tree: {
                    fileA: file('a'),
                },
                expected: [
                    ['fileA', file('a').data],
                ],
            }, {
                name: 'one level',
                tree: {
                    fileA: file('a'),
                    dirA: dir({
                        fileB: file('b'),
                    }),
                },
                expected: [
                    ['fileA', file('a').data],
                    ['dirA/fileB', file('b').data],
                ],
            }, {
                name: 'two levels',
                tree: {
                    fileA: file('a'),
                    dirA: dir({
                        fileB: file('b'),
                        dirB: dir({
                            fileC: file('c'),
                        }),
                    }),
                },
                expected: [
                    ['fileA', file('a').data],
                    ['dirA/fileB', file('b').data],
                    ['dirA/dirB/fileC', file('c').data],
                ],
            }, {
                name: 'two levels, no files',
                tree: {
                    dirA: dir({
                        dirB: dir({
                        }),
                    }),
                },
                expected: [],
            },
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                assert.deepStrictEqual(
                    new CharmSourceCode(tt.tree).getFiles(),
                    new Map<string, CharmSourceCodeFile>(tt.expected)
                );
            });
        }
    });
});