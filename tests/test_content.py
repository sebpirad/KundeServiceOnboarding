"""Content integrity — the source of truth must stay coherent."""

from __future__ import annotations

from onboarding import content


def test_seven_phases() -> None:
    assert len(content.PHASES) == 7
    assert [p["num"] for p in content.PHASES] == [1, 2, 3, 4, 5, 6, 7]


def test_total_items() -> None:
    assert content.total_items() == 43


def test_phase_item_distribution() -> None:
    counts = [len(p["items"]) for p in content.build_phases()]
    assert counts == [7, 14, 4, 10, 1, 4, 3]


def test_item_keys_unique_and_stable() -> None:
    keys = content.all_item_keys()
    assert len(keys) == content.total_items()
    # build_phases injects the same keys deterministically
    built = {it["key"] for p in content.build_phases() for it in p["items"]}
    assert built == keys


def test_key_format() -> None:
    for p in content.build_phases():
        for idx, it in enumerate(p["items"]):
            assert it["key"] == f"{p['id']}:{idx}"


def test_workspace_phase_is_phase_4() -> None:
    assert content.WORKSPACE_PHASES == {"phase-4"}


def test_every_phase_has_a_tip() -> None:
    for p in content.build_phases():
        assert p["tip"] and p["tip"]["text"]
