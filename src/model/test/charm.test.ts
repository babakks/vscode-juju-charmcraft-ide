import { assert } from "chai";
import { readFileSync } from "fs";
import { suite, test } from "mocha";
import { TextDecoder } from "util";
import {
    SourceCode,
    SourceCodeCharmTestClass,
    SourceCodeClass,
    SourceCodeFile,
    SourceCodeFileAnalyzer,
    SourceCodeFunction,
    SourceCodeTree,
    SourceCodeTreeDirectoryEntry,
    SourceCodeTreeFileEntry,
    getNodeExtendedRange,
    getNodeRange,
    unquoteSymbol
} from "../charm";
import { Range, escapeRegex } from "../common";
import path = require('path');

suite(SourceCodeFileAnalyzer.name, function () {
    function makeSUT(fixtureName: string): SourceCodeFileAnalyzer {
        const base = path.join(__dirname, '../../../resource/test/ast');
        const content = new TextDecoder().decode(readFileSync(path.join(base, fixtureName + '.py')));
        const ast = JSON.parse(new TextDecoder().decode(readFileSync(path.join(base, fixtureName + '.json'))));
        return new SourceCodeFileAnalyzer(content, ast);
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
        assert.deepOwnInclude(cs.methods[0], { name: '__init__', kind: 'method', isStatic: false, isAsync: false, positionalParameters: ['self'], range: { start: { line: 8, character: 4 }, end: { line: 11, character: 79 } }, extendedRange: { start: { line: 8, character: 4 }, end: { line: 13, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[1], { name: '_on_start', kind: 'method', isStatic: false, isAsync: false, positionalParameters: ['self', 'event'], range: { start: { line: 13, character: 4 }, end: { line: 14, character: 12 } }, extendedRange: { start: { line: 13, character: 4 }, end: { line: 16, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[2], { name: '_on_config_changed', kind: 'method', isStatic: false, isAsync: false, positionalParameters: ['self', 'event'], range: { start: { line: 16, character: 4 }, end: { line: 17, character: 12 } }, extendedRange: { start: { line: 16, character: 4 }, end: { line: 19, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);

        cs = sut.charmClasses![counter++];
        assert.isDefined(cs);
        assert.equal(cs.name, 'CharmWithProperties');
        assert.deepStrictEqual(cs.bases, ['CharmBase']);
        assert.deepStrictEqual(cs.range, { start: { line: 19, character: 0 }, end: { line: 29, character: 12 } });
        assert.deepStrictEqual(cs.extendedRange, { start: { line: 19, character: 0 }, end: { line: 31, character: 0 } });
        assert.lengthOf(cs.methods, 3);
        assert.deepOwnInclude(cs.methods[0], { name: '__init__', kind: 'method', isStatic: false, isAsync: false, positionalParameters: ['self'], range: { start: { line: 20, character: 4 }, end: { line: 21, character: 31 } }, extendedRange: { start: { line: 20, character: 4 }, end: { line: 23, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[1], { name: 'some_property', kind: 'getter', isStatic: false, isAsync: false, positionalParameters: ['self'], range: { start: { line: 24, character: 4 }, end: { line: 25, character: 12 } }, extendedRange: { start: { line: 24, character: 4 }, end: { line: 27, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[2], { name: 'some_property', kind: 'setter', isStatic: false, isAsync: false, positionalParameters: ['self', 'value'], range: { start: { line: 28, character: 4 }, end: { line: 29, character: 12 } }, extendedRange: { start: { line: 28, character: 4 }, end: { line: 31, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);

        cs = sut.charmClasses![counter++];
        assert.isDefined(cs);
        assert.equal(cs.name, 'CharmWithStaticMethods');
        assert.deepStrictEqual(cs.bases, ['CharmBase']);
        assert.deepStrictEqual(cs.range, { start: { line: 31, character: 0 }, end: { line: 37, character: 12 } });
        assert.deepStrictEqual(cs.extendedRange, { start: { line: 31, character: 0 }, end: { line: 39, character: 0 } });
        assert.lengthOf(cs.methods, 2);
        assert.deepOwnInclude(cs.methods[0], { name: 'static_method', kind: 'method', isStatic: true, isAsync: false, positionalParameters: [], range: { start: { line: 32, character: 4 }, end: { line: 33, character: 12 } }, extendedRange: { start: { line: 32, character: 4 }, end: { line: 35, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(cs.methods[1], { name: 'static_method_with_decorator', kind: 'method', isStatic: true, isAsync: false, positionalParameters: ['param'], range: { start: { line: 36, character: 4 }, end: { line: 37, character: 12 } }, extendedRange: { start: { line: 36, character: 4 }, end: { line: 39, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
    });

    test('charm-test-01-unittest', function () {
        const sut = makeSUT('charm-test-01-unittest');

        assert.isEmpty(sut.testFunctions);
        assert(sut.testClasses);
        assert.lengthOf(sut.testClasses, 2);
        let tc: SourceCodeCharmTestClass;

        tc = sut.testClasses[0];
        assert.isDefined(tc);
        assert.equal(tc.name, 'TestCharmOne');
        assert.deepStrictEqual(tc.bases, ['TestCase']);
        assert.deepStrictEqual(tc.dialect, 'unittest.TestCase');
        assert.deepStrictEqual(tc.range, { start: { line: 7, character: 0 }, end: { line: 12, character: 12 } });
        assert.deepStrictEqual(tc.extendedRange, { start: { line: 7, character: 0 }, end: { line: 14, character: 0 } });
        assert.lengthOf(tc.testMethods, 1);
        assert.deepOwnInclude(tc.testMethods[0], { name: 'test_something', kind: 'method', isStatic: false, isAsync: false, positionalParameters: ['self'], range: { start: { line: 11, character: 4 }, end: { line: 12, character: 12 } }, extendedRange: { start: { line: 11, character: 4 }, end: { line: 14, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);

        tc = sut.testClasses[1];
        assert.isDefined(tc);
        assert.equal(tc.name, 'TestCharmTwo');
        assert.deepStrictEqual(tc.bases, ['TestCase']);
        assert.deepStrictEqual(tc.dialect, 'unittest.TestCase');
        assert.deepStrictEqual(tc.range, { start: { line: 14, character: 0 }, end: { line: 19, character: 12 } });
        assert.deepStrictEqual(tc.extendedRange, { start: { line: 14, character: 0 }, end: { line: 23, character: 0 } });
        assert.lengthOf(tc.testMethods, 1);
        assert.deepOwnInclude(tc.testMethods[0], { name: 'test_something', kind: 'method', isStatic: false, isAsync: false, positionalParameters: ['self'], range: { start: { line: 18, character: 4 }, end: { line: 19, character: 12 } }, extendedRange: { start: { line: 18, character: 4 }, end: { line: 23, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
    });

    test('charm-test-02-pytest-function', function () {
        const sut = makeSUT('charm-test-02-pytest-function');

        assert.isEmpty(sut.testClasses);
        assert(sut.testFunctions);
        assert.lengthOf(sut.testFunctions, 2);
        let tf: SourceCodeFunction;

        tf = sut.testFunctions[0];
        assert.deepOwnInclude(tf, {
            name: 'test_something',
            isStatic: false,
            isAsync: false,
            kind: 'function',
            positionalParameters: ['test'],
            range: { start: { line: 4, character: 0 }, end: { line: 5, character: 8 } },
            extendedRange: { start: { line: 4, character: 0 }, end: { line: 7, character: 0 } },
        } satisfies Omit<SourceCodeFunction, 'raw'>);

        tf = sut.testFunctions[1];
        assert.deepOwnInclude(tf, {
            name: 'test_something_async',
            isStatic: false,
            isAsync: true,
            kind: 'function',
            positionalParameters: ['test'],
            range: { start: { line: 7, character: 0 }, end: { line: 8, character: 8 } },
            extendedRange: { start: { line: 7, character: 0 }, end: { line: 12, character: 0 } },
        } satisfies Omit<SourceCodeFunction, 'raw'>);
    });

    test('charm-test-03-pytest-class', function () {
        const sut = makeSUT('charm-test-03-pytest-class');

        assert.isEmpty(sut.testFunctions);
        assert(sut.testClasses);
        assert.lengthOf(sut.testClasses, 1);
        let tc: SourceCodeCharmTestClass;

        tc = sut.testClasses[0];
        assert.isDefined(tc);
        assert.equal(tc.name, 'TestClass');
        assert.deepStrictEqual(tc.bases, []);
        assert.deepStrictEqual(tc.dialect, 'pytest');
        assert.deepStrictEqual(tc.range, { start: { line: 4, character: 0 }, end: { line: 12, character: 12 } });
        assert.deepStrictEqual(tc.extendedRange, { start: { line: 4, character: 0 }, end: { line: 14, character: 0 } });
        assert.lengthOf(tc.testMethods, 2);
        assert.deepOwnInclude(tc.testMethods[0], { name: 'test_something', kind: 'method', isStatic: false, isAsync: false, positionalParameters: ['self', 'test'], range: { start: { line: 5, character: 4 }, end: { line: 6, character: 12 } }, extendedRange: { start: { line: 5, character: 4 }, end: { line: 8, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
        assert.deepOwnInclude(tc.testMethods[1], { name: 'test_something_async', kind: 'method', isStatic: false, isAsync: true, positionalParameters: ['self', 'test'], range: { start: { line: 8, character: 4 }, end: { line: 9, character: 12 } }, extendedRange: { start: { line: 8, character: 4 }, end: { line: 11, character: 0 } } } satisfies Omit<SourceCodeFunction, 'raw'>);
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

suite(SourceCode.name, function () {
    function file(content: string = ''): SourceCodeTreeFileEntry {
        return { kind: 'file', data: new SourceCodeFile(content, {}, true) };
    }
    function dir(content: SourceCodeTree): SourceCodeTreeDirectoryEntry {
        return { kind: 'directory', data: content };
    }

    suite(SourceCode.prototype.getFiles.name, function () {
        type TestCase = {
            name: string;
            tree: SourceCodeTree;
            expected: [string, SourceCodeFile][];
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
                    new SourceCode(tt.tree).getFiles(),
                    new Map<string, SourceCodeFile>(tt.expected)
                );
            });
        }
    });
});

suite(escapeRegex.name, function () {
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
            name: 'whitespace',
            arg: ' \t',
            expected: ' \t',
        }, {
            name: 'only special chars',
            arg: '/-\\^$*+?.()|[]{}',
            expected: '\\/\\-\\\\\\^\\$\\*\\+\\?\\.\\(\\)\\|\\[\\]\\{\\}',
        }, {
            name: 'mixed',
            arg: 'no special chars so far, /-\\^$*+?.()|[]{}, no specials chars here, too',
            expected: 'no special chars so far, \\/\\-\\\\\\^\\$\\*\\+\\?\\.\\(\\)\\|\\[\\]\\{\\}, no specials chars here, too',
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.strictEqual(escapeRegex(tt.arg), tt.expected);
        });
    }
});