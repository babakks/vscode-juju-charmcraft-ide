import { assert } from "chai";
import { suite, test } from "mocha";
import { Linter, LinterMessage, LinterOutputParser, codespellOutputParser, flake8OutputParser, mypyOutputParser, parseGenericLinterOutput, pydocstyleOutputParser, pylintOutputParser, ruffOutputParser } from "../lint.parser";
import { Range } from "../model/common";
import { newRange, unindent } from "./util";

suite(parseGenericLinterOutput.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'possible cases',
            content: unindent(`
                /absolute/path:11:normal with no whitespace
                /absolute/path:12: normal with whitespace before message
                /absolute/path:13 no trailing colon after line number
                /absolute/path:14:99: with col number
                /absolute/path:15:99 with col number, without trailing colon
                relative/path:21:normal with no whitespace
                relative/path:22: normal with whitespace before message
                relative/path:23 no trailing colon after line number
                relative/path:24:99: with col number
                relative/path:25:99 with col number, without trailing colon
            `),
            expected: [{
                linter: 'generic',
                absolutePath: '/absolute/path',
                range: newRange(10, 0, 11, 0),
                message: 'normal with no whitespace',
            }, {
                linter: 'generic',
                absolutePath: '/absolute/path',
                range: newRange(11, 0, 12, 0),
                message: 'normal with whitespace before message',
            }, {
                linter: 'generic',
                absolutePath: '/absolute/path',
                range: newRange(12, 0, 13, 0),
                message: 'no trailing colon after line number',
            }, {
                linter: 'generic',
                absolutePath: '/absolute/path',
                range: newRange(13, 99, 14, 0),
                message: 'with col number',
            }, {
                linter: 'generic',
                absolutePath: '/absolute/path',
                range: newRange(14, 99, 15, 0),
                message: 'with col number, without trailing colon',
            }, {
                linter: 'generic',
                relativePath: 'relative/path',
                range: newRange(20, 0, 21, 0),
                message: 'normal with no whitespace',
            }, {
                linter: 'generic',
                relativePath: 'relative/path',
                range: newRange(21, 0, 22, 0),
                message: 'normal with whitespace before message',
            }, {
                linter: 'generic',
                relativePath: 'relative/path',
                range: newRange(22, 0, 23, 0),
                message: 'no trailing colon after line number',
            }, {
                linter: 'generic',
                relativePath: 'relative/path',
                range: newRange(23, 99, 24, 0),
                message: 'with col number',
            }, {
                linter: 'generic',
                relativePath: 'relative/path',
                range: newRange(24, 99, 25, 0),
                message: 'with col number, without trailing colon',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(parseGenericLinterOutput(tt.content), tt.expected);
        });
    }
});

suite(flake8OutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: '/absolute/path:11:22: E303 too many blank lines',
            expected: [{
                linter: 'flake8',
                absolutePath: '/absolute/path',
                range: newRange(10, 21, 11, 0),
                message: 'E303 too many blank lines',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                /absolute/path/one:11:22: E### message 1
                /absolute/path/two:33:44: E### message 2
                /absolute/path/two:55:66: E### message 3
            `),
            expected: [{
                linter: 'flake8',
                absolutePath: '/absolute/path/one',
                range: newRange(10, 21, 11, 0),
                message: 'E### message 1',
            },
            {
                linter: 'flake8',
                absolutePath: '/absolute/path/two',
                range: newRange(32, 43, 33, 0),
                message: 'E### message 2',
            },
            {
                linter: 'flake8',
                absolutePath: '/absolute/path/two',
                range: newRange(54, 65, 55, 0),
                message: 'E### message 3',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(flake8OutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});

suite(pylintOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: 'relative/path:11:22: C0303: Trailing whitespace (trailing-whitespace)',
            expected: [{
                linter: 'pylint',
                relativePath: 'relative/path',
                range: newRange(10, 22, 11, 0),
                message: 'C0303: Trailing whitespace (trailing-whitespace)',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                relative/path/one:11:22: C####: message 1
                relative/path/two:33:44: C####: message 2
                relative/path/two:55:66: C####: message 3
            `),
            expected: [{
                linter: 'pylint',
                relativePath: 'relative/path/one',
                range: newRange(10, 22, 11, 0),
                message: 'C####: message 1',
            },
            {
                linter: 'pylint',
                relativePath: 'relative/path/two',
                range: newRange(32, 44, 33, 0),
                message: 'C####: message 2',
            },
            {
                linter: 'pylint',
                relativePath: 'relative/path/two',
                range: newRange(54, 66, 55, 0),
                message: 'C####: message 3',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(pylintOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});

suite(ruffOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: 'relative/path:11:22: W291 [*] Trailing whitespace',
            expected: [{
                linter: 'ruff',
                relativePath: 'relative/path',
                range: newRange(10, 21, 11, 0),
                message: 'W291 [*] Trailing whitespace',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                relative/path/one:11:22: E### message 1
                relative/path/two:33:44: E### message 2
                relative/path/two:55:66: E### message 3
            `),
            expected: [{
                linter: 'ruff',
                relativePath: 'relative/path/one',
                range: newRange(10, 21, 11, 0),
                message: 'E### message 1',
            },
            {
                linter: 'ruff',
                relativePath: 'relative/path/two',
                range: newRange(32, 43, 33, 0),
                message: 'E### message 2',
            },
            {
                linter: 'ruff',
                relativePath: 'relative/path/two',
                range: newRange(54, 65, 55, 0),
                message: 'E### message 3',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(ruffOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});

suite(mypyOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: 'relative/path:11: error: something [scope]',
            expected: [{
                linter: 'mypy',
                relativePath: 'relative/path',
                range: newRange(10, 0, 11, 0),
                message: 'error: something [scope]',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                relative/path/one:11: error: message 1 [scope]
                relative/path/two:33: error: message 2 [scope]
                relative/path/two:55: error: message 3 [scope]
            `),
            expected: [{
                linter: 'mypy',
                relativePath: 'relative/path/one',
                range: newRange(10, 0, 11, 0),
                message: 'error: message 1 [scope]',
            },
            {
                linter: 'mypy',
                relativePath: 'relative/path/two',
                range: newRange(32, 0, 33, 0),
                message: 'error: message 2 [scope]',
            },
            {
                linter: 'mypy',
                relativePath: 'relative/path/two',
                range: newRange(54, 0, 55, 0),
                message: 'error: message 3 [scope]',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(mypyOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});

suite(codespellOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: '/absolute/path:11: adn ==> and',
            expected: [{
                linter: 'codespell',
                absolutePath: '/absolute/path',
                range: newRange(10, 0, 11, 0),
                message: 'adn ==> and',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                /absolute/path/one:11: adn ==> and
                /absolute/path/two:22: fro ==> for, from
                /absolute/path/two:33: fomr ==> from, form
            `),
            expected: [{
                linter: 'codespell',
                absolutePath: '/absolute/path/one',
                range: newRange(10, 0, 11, 0),
                message: 'adn ==> and',
            },
            {
                linter: 'codespell',
                absolutePath: '/absolute/path/two',
                range: newRange(21, 0, 22, 0),
                message: 'fro ==> for, from',
            },
            {
                linter: 'codespell',
                absolutePath: '/absolute/path/two',
                range: newRange(32, 0, 33, 0),
                message: 'fomr ==> from, form',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(codespellOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});


suite(pydocstyleOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single entry',
            content: unindent(`
            /absolute/path:11 in public function \`foo\`:
                    D102: Missing docstring in public method
            `),
            expected: [{
                linter: 'pydocstyle',
                absolutePath: '/absolute/path',
                range: newRange(10, 0, 11, 0),
                message: 'in public function \`foo\`: D102: Missing docstring in public method',
            }],
        }, {
            name: 'multiple entries',
            content: unindent(`
            /absolute/path/one:11 in function \`foo\`:
                    D###: message 1
            /absolute/path/two:22 in function \`bar\`:
                    D###: message 2
            /absolute/path/two:33 in function \`baz\`:
                    D###: message 3
            `),
            expected: [{
                linter: 'pydocstyle',
                absolutePath: '/absolute/path/one',
                range: newRange(10, 0, 11, 0),
                message: 'in function `foo`: D###: message 1',
            },
            {
                linter: 'pydocstyle',
                absolutePath: '/absolute/path/two',
                range: newRange(21, 0, 22, 0),
                message: 'in function `bar`: D###: message 2',
            },
            {
                linter: 'pydocstyle',
                absolutePath: '/absolute/path/two',
                range: newRange(32, 0, 33, 0),
                message: 'in function `baz`: D###: message 3',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(pydocstyleOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});