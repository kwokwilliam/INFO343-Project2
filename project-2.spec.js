'use strict';
const fs = require('fs');
const path = require('path');
const stylelint = require('stylelint');
const htmllint = require('htmllint');
const ESLintEngine = require("eslint").CLIEngine;

//load the files to check
const html = fs.readFileSync(__dirname + '/index.html', 'utf-8');
const JS_FILE_PATH = __dirname + '/js/index.js';
const cssFile = fs.readFileSync(__dirname + '/css/style.css', 'utf-8');

//htmlllint options
const lintOpts = {
    'attr-bans': ['align', 'background', 'bgcolor', 'border', 'frameborder', 'marginwidth', 'marginheight', 'scrolling', 'style', 'width', 'height'], //adding height, allow longdesc
    'tag-bans': ['style', 'b'], //<i> allowed for font-awesome
    'doctype-first': true,
    'doctype-html5': true,
    'html-req-lang': true,
    'line-end-style': false, //either way
    'indent-style': 'nonmixed', // need to choose
    'indent-width': 4, //do need to beautify
    'class-style': 'none', //I like dashes in classnames
    'id-class-style': false,
    'img-req-alt': true, //for this test; captured later!
};

describe('Source code is valid', () => {
    test('HTML validates without errors', async () => {
        let htmlValidityObj = await htmllint(html, lintOpts);
        expect(htmlValidityObj).htmlLintResultsContainsNoErrors();
    });

    test('CSS validates without errors', async () => {
        let cssValidityObj = await stylelint.lint({
            files: __dirname + 'css/style.css'
        });
        expect(cssValidityObj).cssLintResultsContainsNoErrors();
    });

    test('JavaScript lints without errors', async () => {
        expect([JS_FILE_PATH]).toHaveNoEsLintErrors();
    });
});

const styleMatchers = {
    //takes in an array of sources and a configuration object for ESLint
    toHaveNoEsLintErrors(sourcesList, options) {
        const linter = new ESLintEngine(options); //load the configuration
        let report = linter.executeOnFiles(sourcesList); //lint the sources

        const SEVERITY_MSG = { 1: "Warn", 2: "Error" }; //for printing

        //what to return
        const pass = report.errorCount === 0;
        if (pass) {
            return { pass: true, message: () => "expected JavaScript to show linting errors" };
        }
        else {
            return {
                pass: false, message: () => (
                    //loop through and build the result string
                    report.results.reduce((fout, fileMessages) => {
                        return (
                            fileMessages.filePath + '\n' +
                            fileMessages.messages.reduce((out, msg) => {
                                return out + `    ${SEVERITY_MSG[msg.severity]}: ${msg.message} At line ${msg.line}, column ${msg.column}` + '\n';
                            }, '')
                        )
                    }, '')
                )
            };
        }
    },

    //using htmllint
    htmlLintResultsContainsNoErrors(validityObj) {
        const pass = validityObj.length === 0;
        if (pass) {
            return { pass: true, message: () => "expected html to contain validity errors" };
        }
        else {
            return {
                pass: false, message: () => (
                    //loop through and build the result string
                    //these error messages could be more detailed; maybe do manually later
                    validityObj.reduce((out, msg) => {
                        return out + `Error: '${msg.rule}' at line ${msg.line}, column ${msg.column}.\n`
                    }, '')
                )
            };
        }
    },

    //using stylelint errors
    cssLintResultsContainsNoErrors(validityObj) {
        const pass = validityObj.errored === false;
        if (pass) {
            return { pass: true, message: () => "expected CSS to contain validity errors" };
        }
        else {
            return {
                pass: false, message: () => (
                    //loop through and build the result string
                    JSON.parse(validityObj.output)[0].warnings.reduce((out, msg) => {
                        return out + `${msg.severity}: ${msg.text}\n       At line ${msg.line}, column ${msg.column}.\n`
                    }, '')
                )
            };
        }
    }
};
expect.extend(styleMatchers);

//Custom code validation matchers (for error output)
expect.extend({

});