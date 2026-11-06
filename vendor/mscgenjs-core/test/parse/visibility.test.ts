import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import * as xu from "../../src/parse/xuparser";
import { getMetaInfo } from "../../src/parse/parserHelpers";
import {
  hasHiddenAttributes,
  resolveVisibility,
} from "../../src/parse/visibility";
import { render as toXu } from "../../src/render/text/ast2xu";
import { render as toMsc } from "../../src/render/text/ast2mscgen";
import { render as toMsgenny } from "../../src/render/text/ast2msgenny";
import { render as toDot } from "../../src/render/text/ast2dot";
import { render as toDoxygen } from "../../src/render/text/ast2doxygen";
import { clean, render } from "../../src/render/graphics/renderast";
import {
  seedRandom,
  clearRandom,
  random,
} from "../../src/render/graphics/svgelementfactory/wobbly/random";
const Ajv = require("ajv");
const schema = require("../../src/parse/mscgenjs-ast.schema.json");

describe("Xu hidden attributes", () => {
  it("normalizes quoted/unquoted values and preserves all authored states", () => {
    const ast = xu.parse(
      'xu { a [HIDDEN="TrUe"], b [hidden=false]; a loop b [hidden=inherit] { a => b [hidden="FALSE"]; }; }',
    );
    assert.equal(ast.entities[0].hidden, true);
    assert.equal(ast.entities[1].hidden, false);
    assert.equal(ast.arcs[0][0].hidden, "inherit");
    assert.equal(ast.meta.extendedFeatures, true);
    assert.deepEqual(xu.parse(toXu(ast)), ast);
    assert.deepEqual(xu.parse(toXu(JSON.parse(JSON.stringify(ast)))), ast);
    assert.equal(new Ajv().compile(schema)(ast), true);
    assert.equal(
      Object.hasOwn(xu.parse("xu { a; }").entities[0], "hidden"),
      false,
    );
    assert.deepEqual(
      getMetaInfo(undefined, [[{ kind: "->", hidden: false }]]),
      {
        extendedOptions: false,
        extendedArcTypes: false,
        extendedFeatures: true,
      },
    );
  });

  it("rejects invalid Xu and direct JSON values", () => {
    for (const value of ["off", "on", "1", "0", "maybe", '""']) {
      assert.throws(
        () => xu.parse(`xu { a [hidden=${value}]; }`),
        /hidden must be/,
      );
    }
    const validate = new Ajv().compile(schema);
    for (const value of [null, 0, "false", "true", "INHERIT", {}]) {
      const ast = xu.parse("xu { a,b; a => b; }");
      ast.entities[0].hidden = value;
      assert.equal(validate(ast), false);
      assert.throws(() => resolveVisibility(ast), /hidden must be/);
      delete ast.entities[0].hidden;
      ast.arcs[0][0].hidden = value;
      assert.throws(() => resolveVisibility(ast), /hidden must be/);
    }
  });

  it("resolves syntactic ancestry without mutating the source or following references", () => {
    const ast = xu.parse(`xu { a [hidden=true],b; a loop b [hidden=true] {
      a => b;
      a alt b [hidden=false] {
        a => b [hidden=inherit]; b => a [hidden=true];
      };
      a => b [hidden=inherit];
    }; a => b; }`);
    const original = structuredClone(ast);
    const resolved = resolveVisibility(ast);
    assert.deepEqual(ast, original);
    const loop = resolved.arcs[0][0];
    assert.equal(loop.arcs[0][0].hidden, true);
    assert.equal(loop.arcs[1][0].hidden, false);
    assert.equal(loop.arcs[1][0].arcs[0][0].hidden, false);
    assert.equal(loop.arcs[1][0].arcs[1][0].hidden, true);
    assert.equal(loop.arcs[2][0].hidden, true);
    assert.equal(resolved.arcs[1][0].hidden, false);
    assert.equal(
      resolveVisibility(xu.parse("xu { a; }")).entities[0].hidden,
      false,
    );
  });

  it("blocks lossy exporters for any authored state, including nested attributes", () => {
    for (const value of ["true", "false", "inherit"]) {
      const ast = xu.parse(
        `xu { a,b; a loop b { a => b [hidden=${value}]; }; }`,
      );
      for (const convert of [toMsc, toMsgenny, toDot, toDoxygen]) {
        assert.throws(() => convert(ast), /cannot preserve hidden/);
      }
    }
    assert.equal(
      hasHiddenAttributes(xu.parse("xu { a [hidden=false]; }")),
      true,
    );
    assert.equal(hasHiddenAttributes({}), false);
  });

  it("hides complete components without changing generated geometry in any style", () => {
    const source = `xu { wordwraparcs=true; a [label="Tall\\nentity\\nheader"],b,c;
      a loop c [label="Outer"] {
        a => b [label="call",url="https://example.com",id="1",idurl="https://example.com"];
        b => b [label="self"], a note c [label="Several\\nlines\\nin a note"];
        a => * [label="broadcast"];
        --- [label="divider"]; ... [label="omitted"]; ||| [label="space"];
        a alt c [label="Inner"] { b => a [label="revealed", hidden=false]; };
      };
      a => c [arcskip="1",label="skip"]; a abox c; a rbox c; a box c;
    }`;
    const window = new JSDOM('<html><body><div id="chart"></div></body></html>')
      .window;
    for (const style of [null, "lazy", "classic", "inverted", "grayscaled"]) {
      for (const mirrored of [false, true]) {
        const ast = xu.parse(source);
        const original = structuredClone(ast);
        const draw = (input) => {
          clean("chart", window);
          render(input, window, "chart", {
            additionalTemplate: style,
            mirrorEntitiesOnBottom: mirrored,
          });
          return window.document.querySelector("svg").cloneNode(true);
        };
        const baseline = draw(ast);
        assert.deepEqual(ast, original);
        const hidden = structuredClone(ast);
        hidden.entities[0].hidden = true;
        hidden.arcs[0][0].hidden = true;
        const result = draw(hidden);
        const hiddenGroups = result.querySelectorAll('[aria-hidden="true"]');
        assert.ok(hiddenGroups.length > 15);
        assert.ok(
          [...result.querySelectorAll("text")]
            .find((el) => el.textContent.includes("revealed"))
            .closest('[aria-hidden="true"]') === null,
        );
        hiddenGroups.forEach((el) => {
          assert.equal(el.style.pointerEvents, "none");
          el.style.removeProperty("visibility");
          el.style.removeProperty("pointer-events");
          if (!el.getAttribute("style")) el.removeAttribute("style");
          el.removeAttribute("aria-hidden");
        });
        assert.equal(result.outerHTML, baseline.outerHTML);
        assert.equal(draw(ast).outerHTML, baseline.outerHTML);
      }
    }
  });

  it("resets seeded drawing randomness and excludes visibility from its seed", () => {
    seedRandom({ a: 1, hidden: true });
    const first = random();
    seedRandom({ a: 1, hidden: false });
    assert.equal(random(), first);
    clearRandom();
    assert.ok(random() >= 0 && random() < 1);
  });
});
