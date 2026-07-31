export function escapeHumanValue(value: string): string {
  return value.replace(/[\\\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (character) => {
    if (character === "\\") return "\\\\";
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) return "";
    const hex = codePoint.toString(16).padStart(4, "0");
    return codePoint <= 0xffff ? `\\u${hex}` : `\\u{${hex}}`;
  });
}

export function quoteHumanValue(value: string): string {
  return `"${escapeHumanValue(value).replaceAll('"', '\\"')}"`;
}
