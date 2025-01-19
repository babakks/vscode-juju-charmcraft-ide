import { assert } from "chai";
import { suite, test } from "mocha";
import type { CharmToxConfig } from "../model/tox.ini";
import { parseToxINI } from "../parser/tox.ini";
import { unindent } from "./util";

suite(parseToxINI.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: CharmToxConfig;
    };

    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: { sections: {} },
        }, {
            name: 'invalid INI',
            content: '?',
            expected: { sections: {} },
        }, {
            name: 'no section',
            content: unindent(`
                key=value
            `),
            expected: { sections: {} },
        }, {
            name: 'empty section',
            content: unindent(`
                [section]
            `),
            expected: {
                sections: {
                    section: {
                        name: 'section',
                        env: 'section',
                        parent: '',
                    },
                },
            },
        }, {
            name: 'non-empty section',
            content: unindent(`
                [section]
                key=value
            `),
            expected: {
                sections: {
                    section: {
                        name: 'section',
                        env: 'section',
                        parent: '',
                    },
                },
            },
        }, {
            name: 'non-empty section with parent',
            content: unindent(`
                [parent:env]
                key=value
            `),
            expected: {
                sections: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'parent:env': {
                        name: 'parent:env',
                        env: 'env',
                        parent: 'parent',
                    },
                },
            },
        }, {
            name: 'multiple non-empty sections',
            content: unindent(`
                [a]
                key=value
                [b]
                key=value
            `),
            expected: {
                sections: {
                    'a': {
                        name: 'a',
                        env: 'a',
                        parent: '',
                    },
                    'b': {
                        name: 'b',
                        env: 'b',
                        parent: '',
                    },
                },
            },
        }, {
            name: 'multiple non-empty sections',
            content: unindent(`
                [parent-a:a]
                key=value
                [parent-b:b]
                key=value
            `),
            expected: {
                sections: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'parent-a:a': {
                        name: 'parent-a:a',
                        env: 'a',
                        parent: 'parent-a',
                    },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'parent-b:b': {
                        name: 'parent-b:b',
                        env: 'b',
                        parent: 'parent-b',
                    },
                },
            },
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            const value = parseToxINI(tt.content);
            assert.deepStrictEqual(value, tt.expected);
        });
    }
});