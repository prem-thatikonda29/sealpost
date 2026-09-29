"""
Coverage for the font pipeline: the vendored library, the face lookup built on
top of it, and the two render behaviours that were silently wrong.

The naming contract this file pins down is load-bearing and easy to break:
`_load_font` finds a bold or italic face by probing for a sibling file named
after the regular face's *stem*. Rename `Inter.ttf` to `Inter-Regular.ttf` and
every probe misses, bold silently renders as regular, and nothing raises — so
the tests that assert `getname()` are the only thing standing between a rename
and a whole library quietly losing its weights.
"""
import pytest
from PIL import Image

from backend.cert_engine import (
    _draw_name,
    _load_font,
    available_styles,
    fit_font,
    validate_inputs,
)
from backend.fonts_catalog import all_fonts, by_path, get
from backend.paths import resolve

INTER = "backend/typefaces/inter/Inter.ttf"
OSWALD = "backend/typefaces/oswald/Oswald.ttf"  # published without an italic


# ── The vendored library ──────────────────────────────────────────────────────


class TestCatalog:
    def test_the_library_is_not_empty(self):
        assert len(all_fonts()) >= 10

    def test_every_entry_points_at_a_file_that_exists(self):
        for font in all_fonts():
            assert resolve(font.path).exists(), f"{font.id} → {font.path} is missing"

    def test_paths_are_repo_relative(self):
        # Stored paths are resolved against the repo root, so an absolute path
        # would only work on the machine that wrote it.
        for font in all_fonts():
            assert font.path.startswith("backend/typefaces/")

    def test_declared_weights_match_the_files_on_disk(self):
        for font in all_fonts():
            directory = resolve(font.path).parent
            stem = resolve(font.path).stem
            assert font.has_bold == (directory / f"{stem}-Bold.ttf").exists()
            assert font.has_italic == (directory / f"{stem}-Italic.ttf").exists()

    def test_styles_never_offer_a_face_the_family_lacks(self):
        assert available_styles(OSWALD) == ["normal", "bold"]
        assert available_styles(INTER) == ["normal", "bold", "italic"]

    def test_a_family_with_no_italic_says_so_in_the_catalog(self):
        oswald = get("oswald")
        assert oswald is not None
        assert "italic" not in oswald.styles

    def test_each_family_ships_its_license(self):
        # The binaries are redistributed in this repo; the license text has to
        # travel with them.
        for font in all_fonts():
            directory = resolve(font.path).parent
            assert any(
                (directory / name).exists() for name in ("OFL.txt", "LICENSE.txt")
            ), f"{font.label} has no license file"
            assert font.license != "unknown", f"{font.label} has no license recorded"

    def test_lookup_by_path_round_trips(self):
        for font in all_fonts():
            assert by_path(font.path) == font


# ── Face resolution ───────────────────────────────────────────────────────────


class TestLoadFont:
    def test_regular_resolves_to_the_regular_face(self):
        assert _load_font(INTER, "normal", 48).getname() == ("Inter", "Regular")

    def test_bold_resolves_to_a_real_bold_face(self):
        assert _load_font(INTER, "bold", 48).getname() == ("Inter", "Bold")

    def test_italic_resolves_to_a_real_italic_face(self):
        assert _load_font(INTER, "italic", 48).getname() == ("Inter", "Italic")

    def test_bold_is_not_a_silent_fallback_to_regular(self):
        # The failure this guards is invisible: a missing sibling file yields
        # the regular face, the job succeeds, and every certificate is wrong.
        regular = _load_font(INTER, "normal", 48)
        assert _load_font(INTER, "bold", 48).getname() != regular.getname()

    def test_a_missing_file_names_the_path(self):
        # Pillow's own error names a file descriptor, which is unreadable in a
        # job's failure log.
        with pytest.raises(FileNotFoundError) as exc:
            _load_font("backend/typefaces/inter/DoesNotExist.ttf", "normal", 48)
        assert "DoesNotExist.ttf" in str(exc.value)

    def test_a_corrupt_file_is_reported_as_unreadable(self, tmp_path):
        bad = tmp_path / "NotAFont.ttf"
        bad.write_bytes(b"this is not a font")
        with pytest.raises(FileNotFoundError) as exc:
            _load_font(str(bad), "normal", 48)
        assert "NotAFont.ttf" in str(exc.value)


# ── Up-front validation ───────────────────────────────────────────────────────


class TestValidateInputs:
    def test_accepts_a_template_and_a_catalog_font(self):
        template = self._template()
        validate_inputs(str(template), INTER)

    def test_rejects_an_event_with_no_template(self):
        with pytest.raises(ValueError, match="no template"):
            validate_inputs(None, INTER)

    def test_rejects_a_template_that_is_not_there(self):
        with pytest.raises(ValueError, match="missing"):
            validate_inputs("uploads/nope.png", INTER)

    def test_rejects_a_font_that_is_not_there(self):
        template = self._template()
        with pytest.raises(FileNotFoundError):
            validate_inputs(str(template), "backend/typefaces/inter/Nope.ttf")

    def test_an_empty_font_path_is_allowed(self):
        # The engine falls back to a system font; only a *bad* path is an error.
        template = self._template()
        validate_inputs(str(template), None)

    @staticmethod
    def _template():
        import tempfile
        from pathlib import Path

        directory = Path(tempfile.mkdtemp())
        path = directory / "template.png"
        Image.new("RGB", (1200, 800), "white").save(path)
        return path


# ── Fitting ───────────────────────────────────────────────────────────────────


class TestFitFont:
    def test_keeps_the_requested_size_when_the_text_fits(self):
        assert fit_font("Ada Lovelace", 48, 1400, INTER).size == 48

    def test_shrinks_until_the_text_fits(self):
        text = "Bartholomew Featherstonehaugh-Wallington III"
        font = fit_font(text, 48, 300, INTER)
        assert font.size < 48
        bbox = font.getbbox(text)
        assert (bbox[2] - bbox[0]) <= 300

    def test_never_shrinks_below_the_floor(self):
        # A name longer than max_width is clipped by the frame in both
        # renderers; the floor is what stops it shrinking to nothing.
        font = fit_font("W" * 200, 48, 10, INTER)
        assert font.size == 10

    def test_bold_and_regular_fit_differently(self):
        # Bold is wider, so at the same size it can need a size the regular
        # face does not. Both renderers must agree on which face is measured.
        text = "Bartholomew Featherstonehaugh"
        assert fit_font(text, 48, 400, INTER, "bold").size <= fit_font(
            text, 48, 400, INTER, "normal"
        ).size


# ── Centring ──────────────────────────────────────────────────────────────────


class TestDrawName:
    CANVAS = (1600, 900)
    ANCHOR = (800, 450)
    NAMES = ["Ada Lovelace", "Priya Sharma", "BOB", "Kishan Ojha (BTech CSE)"]

    def _ink_centre(self, name, size, font_path=INTER):
        image = Image.new("RGB", self.CANVAS, "white")
        _draw_name(image, name, self.ANCHOR, _load_font(font_path, "normal", size), "#000000")
        # Anything not near-white is ink.
        bbox = image.convert("L").point(lambda p: 255 if p < 200 else 0).getbbox()
        assert bbox is not None, f"nothing was drawn for {name!r}"
        return ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)

    def test_the_run_is_centred_horizontally(self):
        # "mm" centres on advance width, so this is close to exact.
        for size in (48, 120):
            for name in self.NAMES:
                dx = self._ink_centre(name, size)[0] - self.ANCHOR[0]
                assert abs(dx) <= 4, f"{name!r} at {size}px is off by {dx:.1f}px"

    def test_the_run_is_centred_vertically(self):
        # Bounded relative to size rather than in absolute pixels: the ink box
        # is not the em box, so a name with descenders sits lower than one
        # without. The old "la" anchor (ascender-top) was off by 34–43px at
        # only 48px — far outside this bound.
        for size in (48, 120):
            for name in self.NAMES:
                dy = self._ink_centre(name, size)[1] - self.ANCHOR[1]
                assert abs(dy) <= size * 0.2, f"{name!r} at {size}px is off by {dy:.1f}px"

    def test_the_anchor_is_honoured_across_families(self):
        for font_path in (INTER, OSWALD):
            dx, dy = self._ink_centre("Ada Lovelace", 48, font_path)
            assert abs(dx - self.ANCHOR[0]) <= 4
            assert abs(dy - self.ANCHOR[1]) <= 10
