import argparse
import json
from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_java


def parse_java(filepath: Path):
    parser = Parser()
    parser.language = Language(tree_sitter_java.language())
    source = filepath.read_bytes()
    return parser.parse(source)


def build_contract_a(filepath: Path) -> dict:
    parse_java(filepath)

    dependencies = []
    for line_number, line in enumerate(filepath.read_text(encoding='utf-8').splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith('import '):
            import_target = stripped.replace('import ', '').replace(';', '').strip()
            dependencies.append(
                {
                    'filePath': import_target.replace('.', '/') + '.java',
                    'usageContextLine': line_number,
                }
            )

    return {
        'targetFile': str(filepath),
        'gitDiff': '',
        'dependencies': dependencies,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='Analyze Java source and emit ContractA JSON.')
    parser.add_argument('filepath', type=Path)
    args = parser.parse_args()

    result = build_contract_a(args.filepath)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
