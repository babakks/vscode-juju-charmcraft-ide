import { assert } from "chai";
import { suite, test } from "mocha";
import { Range } from "../model/common";
import { YAMLParser } from "../parser/common";
import { newRange, unindent } from "./util";

suite(YAMLParser.name, function () {
    suite(YAMLParser.prototype.parse.name, function () {
        function parse(content: string) {
            return new YAMLParser(content).parse().tree;
        }

        suite('empty', function () {
            type TestCase = {
                name: string;
                content: string;
                expectedRange: Range;
            };
            const tests: TestCase[] = [
                {
                    name: 'empty',
                    content: '',
                    expectedRange: newRange(0, 0, 0, 0),
                }, {
                    name: 'whitespace',
                    content: ' ',
                    expectedRange: newRange(0, 0, 1, 0),
                }, {
                    name: '\\n',
                    content: '\n',
                    expectedRange: newRange(0, 0, 1, 0),
                }, {
                    name: 'mixed whitespace and \\n',
                    content: ' \n  \n ',
                    expectedRange: newRange(0, 0, 3, 0),
                },
            ];

            for (const t of tests) {
                const tt = t;
                test(tt.name, function () {
                    assert.deepInclude(parse(tt.content), {
                        value: {},
                        node: {
                            kind: 'map',
                            problems: [],
                            text: tt.content,
                            range: tt.expectedRange,
                        },
                    });
                });
            }
        });

        test('map', function () {
            const content = unindent(`
                a:
                  aa: 0
                b:
                  bb: 0
                c: 0
            `);

            const root = parse(content)!;

            assert.isDefined(root);
            assert.deepInclude(root.node, {
                kind: 'map',
                problems: [],
                range: newRange(0, 0, 5, 0),
                text: content,
            });
            assert.hasAllKeys(root.value, ['a', 'b', 'c']);

            // a
            assert.deepInclude(root.value['a'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(0, 0, 2, 0),
                text: 'a:\n  aa: 0',
                pairKeyRange: newRange(0, 0, 0, 1),
                pairValueRange: newRange(1, 2, 2, 0),
            });

            assert.deepInclude(root.value['a'].value.node, {
                kind: 'map',
                problems: [],
                range: newRange(1, 2, 2, 0),
                text: 'aa: 0',
            });
            assert.hasAllKeys(root.value['a'].value.value, ['aa']);

            assert.deepInclude(root.value['a'].value.value['aa'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(1, 2, 2, 0),
                text: 'aa: 0',
                pairKeyRange: newRange(1, 2, 1, 4),
                pairValueRange: newRange(1, 6, 2, 0),
            });

            assert.deepInclude(root.value['a'].value.value['aa'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(1, 6, 2, 0),
                text: '0',
            });
            assert.deepStrictEqual(root.value['a'].value.value['aa'].value.value, 0);

            // b
            assert.deepInclude(root.value['b'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(2, 0, 4, 0),
                text: 'b:\n  bb: 0',
                pairKeyRange: newRange(2, 0, 2, 1),
                pairValueRange: newRange(3, 2, 4, 0),
            });

            assert.deepInclude(root.value['b'].value.node, {
                kind: 'map',
                problems: [],
                range: newRange(3, 2, 4, 0),
                text: 'bb: 0',
            });
            assert.hasAllKeys(root.value['b'].value.value, ['bb']);

            assert.deepInclude(root.value['b'].value.value['bb'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(3, 2, 4, 0),
                text: 'bb: 0',
                pairKeyRange: newRange(3, 2, 3, 4),
                pairValueRange: newRange(3, 6, 4, 0),
            });

            assert.deepInclude(root.value['b'].value.value['bb'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(3, 6, 4, 0),
                text: '0',
            });
            assert.deepStrictEqual(root.value['b'].value.value['bb'].value.value, 0);

            // c
            assert.deepInclude(root.value['c'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(4, 0, 5, 0),
                text: 'c: 0',
                pairKeyRange: newRange(4, 0, 4, 1),
                pairValueRange: newRange(4, 3, 5, 0),
            });

            assert.deepInclude(root.value['c'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(4, 3, 5, 0),
                text: '0',
            });
            assert.deepStrictEqual(root.value['c'].value.value, 0);
        });

        test('sequence', function () {
            const content = unindent(`
                - 0
                - 1
            `);

            const root = parse(content)!;

            assert.isDefined(root);
            assert.deepInclude(root.node, {
                kind: 'sequence',
                problems: [],
                range: newRange(0, 0, 2, 0),
                text: content,
            });

            // 0
            assert.deepInclude(root.value[0].node, {
                kind: 'scalar',
                problems: [],
                range: newRange(0, 2, 1, 0),
                text: '0',
            });
            assert.deepStrictEqual(root.value[0].value, 0);

            // 1
            assert.deepInclude(root.value[1].node, {
                kind: 'scalar',
                problems: [],
                range: newRange(1, 2, 2, 0),
                text: '1',
            });
            assert.deepStrictEqual(root.value[1].value, 1);
        });

        test('scalar types', function () {
            const content = unindent(`
                a-null:
                an-empty-string: ""
                a-string: something
                a-number: 999
                a-false: false
                a-true: true
            `);

            const root = parse(content)!;

            assert.isDefined(root);
            assert.deepInclude(root.node, {
                kind: 'map',
                problems: [],
                range: newRange(0, 0, 6, 0),
                text: content,
            });
            assert.hasAllKeys(root.value, ['a-null', 'an-empty-string', 'a-string', 'a-number', 'a-false', 'a-true']);

            // a-null
            assert.deepInclude(root.value['a-null'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(0, 0, 0, 7),
                text: 'a-null:',
                pairKeyRange: newRange(0, 0, 0, 6),
                pairValueRange: newRange(0, 7, 0, 7),
            });
            assert.deepInclude(root.value['a-null'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(0, 7, 0, 7),
                text: '',
            });
            assert.deepStrictEqual(root.value['a-null'].value.value, null);

            // an-empty-string
            assert.deepInclude(root.value['an-empty-string'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(1, 0, 2, 0),
                text: 'an-empty-string: ""',
                pairKeyRange: newRange(1, 0, 1, 15),
                pairValueRange: newRange(1, 17, 2, 0),
            });
            assert.deepInclude(root.value['an-empty-string'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(1, 17, 2, 0),
                text: '""',
            });
            assert.deepStrictEqual(root.value['an-empty-string'].value.value, '');

            // a-string
            assert.deepInclude(root.value['a-string'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(2, 0, 3, 0),
                text: 'a-string: something',
                pairKeyRange: newRange(2, 0, 2, 8),
                pairValueRange: newRange(2, 10, 3, 0),
            });
            assert.deepInclude(root.value['a-string'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(2, 10, 3, 0),
                text: 'something',
            });
            assert.deepStrictEqual(root.value['a-string'].value.value, 'something');

            // a-number
            assert.deepInclude(root.value['a-number'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(3, 0, 4, 0),
                text: 'a-number: 999',
                pairKeyRange: newRange(3, 0, 3, 8),
                pairValueRange: newRange(3, 10, 4, 0),
            });
            assert.deepInclude(root.value['a-number'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(3, 10, 4, 0),
                text: '999',
            });
            assert.deepStrictEqual(root.value['a-number'].value.value, 999);

            // a-false
            assert.deepInclude(root.value['a-false'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(4, 0, 5, 0),
                text: 'a-false: false',
                pairKeyRange: newRange(4, 0, 4, 7),
                pairValueRange: newRange(4, 9, 5, 0),
            });
            assert.deepInclude(root.value['a-false'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(4, 9, 5, 0),
                text: 'false',
            });
            assert.deepStrictEqual(root.value['a-false'].value.value, false);

            // a-true
            assert.deepInclude(root.value['a-true'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(5, 0, 6, 0),
                text: 'a-true: true',
                pairKeyRange: newRange(5, 0, 5, 6),
                pairValueRange: newRange(5, 8, 6, 0),
            });
            assert.deepInclude(root.value['a-true'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(5, 8, 6, 0),
                text: 'true',
            });
            assert.deepStrictEqual(root.value['a-true'].value.value, true);
        });
    });
});
