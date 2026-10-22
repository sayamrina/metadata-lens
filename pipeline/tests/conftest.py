import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
FIX = Path(__file__).parent / "fixtures"

from metalens.harvest import Source, parse_page  # noqa: E402

SOURCE = Source("repo", "Example repository", "https://repo.example/oai", "https://repo.example/")


@pytest.fixture
def pages():
    return [(FIX / "page1.xml").read_text(), (FIX / "page2.xml").read_text()]


@pytest.fixture
def records(pages):
    return parse_page(pages[0], "repo")[0] + parse_page(pages[1], "repo")[0]
