"use strict";
const postcss = require("postcss");

const plugin = require("../src");

const test = async (input, expected) => {
  const processor = await postcss([plugin]);

  expect(processor.process(input).css).toBe(expected);
};

describe("constants", () => {
  it("should pass through an empty string", () => test("", ""));

  it("should export a constant", () =>
    test("@value red blue;", ":export {\n  red: blue\n}"));

  it("gives a warnings when there is no semicolon between lines", async () => {
    const input = "@value red blue\n@value green yellow";
    const processor = postcss([plugin]);
    const result = await processor.process(input, { from: undefined });
    const warnings = result.warnings();

    expect(result.css).toBe(":export {\n  green: yellow\n}");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].text).toBe(
      "Invalid value definition: red blue\n@value green yellow"
    );
  });

  it("gives a warnings on empty value", async () => {
    const input = "@value v-comment:;";
    const processor = postcss([plugin]);
    const result = await processor.process(input, { from: undefined });
    const warnings = result.warnings();

    expect(result.css).toBe("");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].text).toBe("Invalid value definition: v-comment:");
  });

  it("gives a warnings on empty value with comment", async () => {
    const input = "@value v-comment:/* comment */;";
    const processor = postcss([plugin]);
    const result = await processor.process(input, { from: undefined });
    const warnings = result.warnings();

    expect(result.css).toBe("");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].text).toBe("Invalid value definition: v-comment:");
  });

  it("should export a more complex constant", () =>
    test(
      "@value small: (max-width: 599px);",
      ":export {\n  small: (max-width: 599px)\n}"
    ));

  it("should replace constants within the file", () =>
    test(
      "@value blue: red; .foo { color: blue; }",
      ":export {\n  blue: red;\n}\n.foo { color: red; }"
    ));

  it("should replace selectors within the file", () =>
    test(
      "@value colorValue: red; .colorValue { color: colorValue; }",
      ":export {\n  colorValue: red;\n}\n.red { color: red; }"
    ));

  it("should replace selectors within the file #1", () =>
    test(
      "@value colorValue: red; #colorValue { color: colorValue; }",
      ":export {\n  colorValue: red;\n}\n#red { color: red; }"
    ));

  it("should replace selectors within the file #2", () =>
    test(
      "@value colorValue: red; .colorValue > .colorValue { color: colorValue; }",
      ":export {\n  colorValue: red;\n}\n.red > .red { color: red; }"
    ));

  it("should import and re-export a simple constant", () =>
    test(
      '@value red from "./colors.css";',
      ':import("./colors.css") {\n  i__const_red_0: red\n}\n:export {\n  red: i__const_red_0\n}'
    ));

  it("should import a simple constant and replace usages", () =>
    test(
      '@value red from "./colors.css"; .foo { color: red; }',
      ':import("./colors.css") {\n  i__const_red_0: red;\n}\n:export {\n  red: i__const_red_0;\n}\n.foo { color: i__const_red_0; }'
    ));

  it("should import and alias a constant and replace usages", () =>
    test(
      '@value blue as red from "./colors.css"; .foo { color: red; }',
      ':import("./colors.css") {\n  i__const_red_0: blue;\n}\n:export {\n  red: i__const_red_0;\n}\n.foo { color: i__const_red_0; }'
    ));

  it("should import multiple from a single file", () =>
    test(
      `@value blue, red from "./colors.css";
.foo { color: red; }
.bar { color: blue }`,
      `:import("./colors.css") {
  i__const_blue_0: blue;
  i__const_red_1: red;
}
:export {
  blue: i__const_blue_0;
  red: i__const_red_1;
}
.foo { color: i__const_red_1; }
.bar { color: i__const_blue_0 }`
    ));

  it("should import from a definition", () =>
    test(
      '@value colors: "./colors.css"; @value red from colors;',
      ':import("./colors.css") {\n  i__const_red_0: red\n}\n' +
        ':export {\n  colors: "./colors.css";\n  red: i__const_red_0\n}'
    ));

  it("should only allow values for paths if defined in the right order", () =>
    test(
      '@value red from colors; @value colors: "./colors.css";',
      ":import(colors) {\n  i__const_red_0: red\n}\n" +
        ':export {\n  red: i__const_red_0;\n  colors: "./colors.css"\n}'
    ));

  it("should allow transitive values", () =>
    test(
      "@value aaa: red;\n@value bbb: aaa;\n.a { color: bbb; }",
      ":export {\n  aaa: red;\n  bbb: red;\n}\n.a { color: red; }"
    ));

  it("should allow transitive values within calc", () =>
    test(
      "@value base: 10px;\n@value large: calc(base * 2);\n.a { margin: large; }",
      ":export {\n  base: 10px;\n  large: calc(10px * 2);\n}\n.a { margin: calc(10px * 2); }"
    ));

  it("should preserve import order", () =>
    test(
      '@value a from "./a.css"; @value b from "./b.css";',
      ':import("./a.css") {\n  i__const_a_0: a\n}\n' +
        ':import("./b.css") {\n  i__const_b_1: b\n}\n' +
        ":export {\n  a: i__const_a_0;\n  b: i__const_b_1\n}"
    ));

  it("should allow custom-property-style names", () =>
    test(
      '@value --red from "./colors.css"; .foo { color: --red; }',
      ':import("./colors.css") {\n  i__const___red_0: --red;\n}\n' +
        ":export {\n  --red: i__const___red_0;\n}\n" +
        ".foo { color: i__const___red_0; }"
    ));

  it("should allow all colour types", () =>
    test(
      "@value named: red; @value 3char #0f0; @value 6char #00ff00; @value rgba rgba(34, 12, 64, 0.3); @value hsla hsla(220, 13.0%, 18.0%, 1);\n" +
        ".foo { color: named; background-color: 3char; border-top-color: 6char; border-bottom-color: rgba; outline-color: hsla; }",
      ":export {\n  named: red;\n  3char: #0f0;\n  6char: #00ff00;\n  rgba: rgba(34, 12, 64, 0.3);\n  hsla: hsla(220, 13.0%, 18.0%, 1);\n}\n" +
        ".foo { color: red; background-color: #0f0; border-top-color: #00ff00; border-bottom-color: rgba(34, 12, 64, 0.3); outline-color: hsla(220, 13.0%, 18.0%, 1); }"
    ));

  it("should import multiple from a single file on multiple lines", () =>
    test(
      `@value (
  blue,
  red
) from "./colors.css";
.foo { color: red; }
.bar { color: blue }`,
      `:import("./colors.css") {
  i__const_blue_0: blue;
  i__const_red_1: red;
}
:export {
  blue: i__const_blue_0;
  red: i__const_red_1;
}
.foo { color: i__const_red_1; }
.bar { color: i__const_blue_0 }`
    ));

  it("should allow definitions with commas in them", () =>
    test(
      "@value coolShadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14)   ;\n" +
        ".foo { box-shadow: coolShadow; }",
      ":export {\n  coolShadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14);\n}\n" +
        ".foo { box-shadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14); }"
    ));

  it("should allow values with nested parantheses", () =>
    test(
      "@value aaa: color(red lightness(50%));",
      ":export {\n  aaa: color(red lightness(50%))\n}"
    ));

  it("should work with custom properties", () =>
    test(
      "@value v-color: red;\n:root { --color: v-color; }",
      ":export {\n  v-color: red;\n}\n:root { --color: red; }"
    ));

  it("should work with empty custom properties", () =>
    test(
      "@value v-empty: ;\n:root { --color:v-empty; }",
      ":export {\n  v-empty: ;\n}\n:root { --color: ; }"
    ));

  it("should work with empty custom properties #2", () =>
    test(
      "@value v-empty:   ;\n:root { --color:v-empty; }",
      ":export {\n  v-empty:   ;\n}\n:root { --color:   ; }"
    ));

  it("should work with empty custom properties #3", () =>
    test(
      "@value v-empty: /* comment */;\n:root { --color:v-empty; }",
      ":export {\n  v-empty: /* comment */;\n}\n:root { --color: /* comment */; }"
    ));
});
