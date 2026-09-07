const numberTokens = /* @__PURE__ */ Symbol.for("personaos.canonical-json.number-tokens");
const numberPattern = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
function canonicalMember(parent, key, omitUndefined = false) {
  const value = parent[key];
  const token = parent[numberTokens]?.[key];
  if (typeof value === "number" && typeof token === "string" && numberPattern.test(token) && Object.is(Number(token), value)) return token;
  return serialize(value, omitUndefined);
}
function compareKeys(left, right) {
  const a = Array.from(left), b = Array.from(right);
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = a[index].codePointAt(0) - b[index].codePointAt(0);
    if (difference) return difference;
  }
  return a.length - b.length;
}
function serialize(value, omitUndefined) {
  if (value === void 0) return omitUndefined ? void 0 : "null";
  if (value === null) return "null";
  if (Array.isArray(value)) return "[" + value.map((_, index) => canonicalMember(value, index, omitUndefined) ?? "null").join(",") + "]";
  if (typeof value === "object") return "{" + Object.keys(value).filter((key) => !omitUndefined || value[key] !== void 0).sort(compareKeys).map((key) => JSON.stringify(key) + ":" + canonicalMember(value, key, omitUndefined)).join(",") + "}";
  return JSON.stringify(value);
}
const canonicalJson = (value) => serialize(value, false);
const stringifySignedJson = (value) => serialize(value, true);
function parseSignedJson(text) {
  const source = String(text);
  const result = JSON.parse(source);
  const tokens = /\s*("(?:\\[\s\S]|[^"\\])*"|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null|[{}\[\]:,])/gy;
  const next = () => {
    const match = tokens.exec(source);
    if (!match) throw new SyntaxError("Missing JSON token");
    return match[1];
  };
  const walk = (value) => {
    const token = next();
    if (token !== "{" && token !== "[") return typeof value === "number" ? token : null;
    const array = token === "[", end = array ? "]" : "}";
    const saved = /* @__PURE__ */ Object.create(null), seen = /* @__PURE__ */ new Set();
    let current = next(), index = 0;
    while (current !== end) {
      let key;
      if (array) {
        tokens.lastIndex -= current.length;
        key = index++;
      } else {
        key = JSON.parse(current);
        if (seen.has(key)) throw new SyntaxError("Duplicate JSON member");
        seen.add(key);
        if (next() !== ":") throw new SyntaxError("Missing JSON colon");
      }
      const number = walk(value[key]);
      if (number !== null && number !== JSON.stringify(value[key])) saved[key] = number;
      current = next();
      if (current === ",") current = next();
      else if (current !== end) throw new SyntaxError("Missing JSON separator");
    }
    if (Object.keys(saved).length) Object.defineProperty(value, numberTokens, {
      value: Object.freeze(saved),
      enumerable: true
    });
    return null;
  };
  walk(result);
  return result;
}
export {
  canonicalJson,
  canonicalMember,
  parseSignedJson,
  stringifySignedJson
};
