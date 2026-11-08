"""把 HarmonyOS Sans SC 子集化为 woff2，保留界面文字、ASCII、常用中文与符号。

用法: python scripts/subset-font.py <source.ttf> <output.woff2>
"""
import os
import sys

from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def collect_chars() -> str:
    chars = set()

    for dirpath, _, filenames in os.walk(os.path.join(ROOT, "src")):
        for name in filenames:
            if name.endswith((".ts", ".tsx", ".css", ".html")):
                with open(os.path.join(dirpath, name), encoding="utf-8") as handle:
                    chars.update(handle.read())

    index = os.path.join(ROOT, "index.html")
    if os.path.exists(index):
        with open(index, encoding="utf-8") as handle:
            chars.update(handle.read())

    # ASCII 与常用符号区段
    for start, end in [
        (0x20, 0x7E),
        (0xA0, 0xFF),
        (0x2000, 0x206F),
        (0x2190, 0x21FF),
        (0x2600, 0x27BF),
        (0x3000, 0x303F),
        (0xFF00, 0xFFEF),
    ]:
        chars.update(chr(code) for code in range(start, end + 1))

    # GB2312 常用与次常用汉字（6763 字），覆盖大部分备注内容
    for lead in range(0xB0, 0xF8):
        for trail in range(0xA1, 0xFF):
            try:
                chars.add(bytes([lead, trail]).decode("gb2312"))
            except UnicodeDecodeError:
                pass

    return "".join(sorted(chars))


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python scripts/subset-font.py <source.ttf> <output.woff2>")

    source, output = sys.argv[1], sys.argv[2]
    text = collect_chars()
    print(f"characters: {len(text)}")

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.drop_tables.append("DSIG")

    font = subset.load_font(source, options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, output, options)
    print(f"saved: {output} ({os.path.getsize(output) / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
