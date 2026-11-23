"""The Hoops Dynasty title screen and its replaceable menu actions."""

from __future__ import annotations

import os
import sys
import time
from contextlib import AbstractContextManager
from functools import lru_cache
from typing import Callable, Optional, TextIO

from rich import box
from rich.align import Align
from rich.cells import cell_len
from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.text import Text

from theme import COLORS

try:
    from pyfiglet import Figlet, FontNotFound
except ImportError:
    Figlet = None
    FontNotFound = None


BACKGROUND = COLORS["background"]
GOLD = COLORS["gold"]
HIGHLIGHT = COLORS["highlight"]
SECONDARY = COLORS["secondary"]
BASE_STYLE = f"{GOLD} on {BACKGROUND}"
SECONDARY_STYLE = f"{SECONDARY} on {BACKGROUND}"
SELECTED_STYLE = f"bold {BACKGROUND} on {GOLD}"


def make_console() -> Console:
    """Use truecolor in known capable terminals; otherwise let Rich detect it."""
    known_truecolor = bool(os.environ.get("WT_SESSION")) or (
        os.environ.get("TERM_PROGRAM", "").lower() == "vscode"
    )
    return Console(color_system="truecolor" if known_truecolor else "auto")


@lru_cache(maxsize=32)
def logo_lines(available_width: int) -> list[str]:
    """Pick the largest logo that fits, with a dependency-free fallback."""
    if Figlet is not None:
        for font in ("ansi_shadow", "big", "small"):
            try:
                rendered = Figlet(font=font, width=200).renderText("HOOPS DYNASTY")
            except FontNotFound:
                continue
            lines = rendered.rstrip("\n").splitlines()
            if lines and max(cell_len(line) for line in lines) <= available_width:
                return lines
    return ["HOOPS DYNASTY"]


class NonInteractiveTerminalError(Exception):
    """The application cannot read keys from the current input."""


class KeyReader(AbstractContextManager):
    """Read individual keys without requiring Enter or an extra dependency."""

    def __init__(self, stream: TextIO = sys.stdin) -> None:
        self.stream = stream
        self._original_settings = None

    def __enter__(self) -> KeyReader:
        if not self.stream.isatty():
            raise NonInteractiveTerminalError("Hoops Dynasty needs an interactive terminal for keyboard input.")
        if os.name != "nt":
            import termios
            import tty

            self._original_settings = termios.tcgetattr(self.stream.fileno())
            tty.setcbreak(self.stream.fileno())
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        if self._original_settings is not None:
            import termios

            termios.tcsetattr(self.stream.fileno(), termios.TCSADRAIN, self._original_settings)

    def read(self, timeout: float = 0.1) -> Optional[str]:
        """Return a normalized key, or None when no key arrives before timeout."""
        if os.name == "nt":
            import msvcrt

            deadline = time.monotonic() + timeout
            while not msvcrt.kbhit():
                if time.monotonic() >= deadline:
                    return None
                time.sleep(min(0.01, max(0.0, deadline - time.monotonic())))
            key = msvcrt.getwch()
            if key in ("\x00", "\xe0"):
                return {"H": "up", "P": "down"}.get(msvcrt.getwch())
        else:
            import select

            if not select.select([self.stream], [], [], timeout)[0]:
                return None
            key = os.read(self.stream.fileno(), 1).decode("utf-8", errors="replace")
            if key == "\x1b":
                # Arrow keys arrive as an escape sequence, sometimes in separate reads.
                sequence = ""
                for _ in range(2):
                    if not select.select([self.stream], [], [], 0.05)[0]:
                        break
                    sequence += os.read(self.stream.fileno(), 1).decode("ascii", errors="replace")
                return {"[A": "up", "[B": "down", "OA": "up", "OB": "down"}.get(sequence)
        if key == "\x03":
            raise KeyboardInterrupt
        if key in ("\r", "\n"):
            return "enter"
        return key


def new_dynasty(screen: TitleScreen) -> None:
    screen.show_placeholder("New Dynasty")


def load_dynasty(screen: TitleScreen) -> None:
    screen.show_placeholder("Load Dynasty")


def quick_game(screen: TitleScreen) -> None:
    screen.show_placeholder("Quick Game")


def settings(screen: TitleScreen) -> None:
    screen.show_placeholder("Settings")


def how_to_play(screen: TitleScreen) -> None:
    screen.show_placeholder("How to Play")


def exit_game(screen: TitleScreen) -> None:
    screen.running = False


# Replace any action with a real screen without changing the menu loop.
MENU: list[tuple[str, Callable[[TitleScreen], None]]] = [
    ("New Dynasty", new_dynasty),
    ("Load Dynasty", load_dynasty),
    ("Quick Game", quick_game),
    ("Settings", settings),
    ("How to Play", how_to_play),
    ("Exit", exit_game),
]


class TitleScreen:
    """Render the intro and menu inside a full-terminal Rich panel."""

    def __init__(self, console: Console, keys: KeyReader) -> None:
        self.console = console
        self.keys = keys
        self.selected = 0
        self.running = True
        self.live: Optional[Live] = None

    def frame(
        self,
        mode: str,
        visible_logo_lines: Optional[int] = None,
        prompt_visible: bool = True,
        message: str = "",
    ) -> Panel:
        width, height = self.console.size
        inner_width = max(1, width - 4)
        inner_height = max(1, height - 2)
        logo = logo_lines(inner_width)
        if visible_logo_lines is not None:
            logo = logo[:visible_logo_lines]

        rows: list[Text] = [Text(line, style=f"bold {GOLD} on {BACKGROUND}") for line in logo]
        rows.extend(
            [
                Text("    .-'''-.", style=BASE_STYLE),
                Text("  /  \\ | /  \\", style=BASE_STYLE),
                Text(" |---- + ----|", style=BASE_STYLE),
                Text("  \\  / | \\  /", style=BASE_STYLE),
                Text("    '-...-'", style=BASE_STYLE),
                Text("Build a Legacy. One Season at a Time.", style=f"italic {SECONDARY_STYLE}"),
                Text(""),
            ]
        )
        if mode == "intro":
            rows.append(Text("Press ENTER to start" if prompt_visible else "", style=f"bold {HIGHLIGHT} on {BACKGROUND}"))
        elif mode == "menu":
            for index, (label, _) in enumerate(MENU):
                selected = index == self.selected
                marker = "▶" if selected else " "
                rows.append(Text(f"{marker}  {index + 1}. {label}", style=SELECTED_STYLE if selected else BASE_STYLE))
        elif mode == "placeholder":
            rows.append(Text(f"{message} coming soon…", style=f"bold {HIGHLIGHT} on {BACKGROUND}"))
            rows.append(Text("Press ENTER to return to the menu", style=SECONDARY_STYLE))

        # Preserve the menu and footer on short terminals by compacting the artwork.
        available_rows = max(0, inner_height - 1)
        if len(rows) > available_rows:
            compact_logo = [] if visible_logo_lines == 0 else [Text("HOOPS DYNASTY", style=f"bold {GOLD} on {BACKGROUND}")]
            artwork_end = len(logo) + 7
            rows = compact_logo + rows[artwork_end:]
        if len(rows) > available_rows:
            rows = rows[-available_rows:] if available_rows else []

        padding = max(0, available_rows - len(rows))
        top_padding = padding // 2
        bottom_padding = padding - top_padding
        for row in rows:
            row.no_wrap = True
            row.overflow = "ellipsis"
        centered_rows = [Align.center(row, width=inner_width) for row in rows]
        left, right = "v0.1.0", "© 2026 Hoops Dynasty"
        if len(left) + len(right) + 1 <= inner_width:
            footer = left + " " * (inner_width - len(left) - len(right)) + right
        else:
            footer = (left + " " + right)[:inner_width]
        content = Group(
            *([Text("")] * top_padding),
            *centered_rows,
            *([Text("")] * bottom_padding),
            Text(footer, style=SECONDARY_STYLE, no_wrap=True),
        )
        return Panel(
            content,
            box=box.ROUNDED,
            border_style=GOLD,
            style=BASE_STYLE,
            width=width,
            height=height,
            padding=(0, 1),
        )

    def redraw(self, *args, **kwargs) -> None:
        if self.live is None:
            raise RuntimeError("The title screen is not running.")
        self.live.update(self.frame(*args, **kwargs), refresh=True)

    def intro(self) -> None:
        count = len(logo_lines(max(1, self.console.size.width - 4)))
        for visible in range(1, count + 1):
            self.redraw("intro", visible_logo_lines=visible, prompt_visible=False)
            time.sleep(0.05)

        prompt_started = time.monotonic()
        while True:
            visible = int((time.monotonic() - prompt_started) * 2) % 2 == 0
            self.redraw("intro", prompt_visible=visible)
            if self.keys.read(0.1) == "enter":
                return

    def show_placeholder(self, label: str) -> None:
        self.redraw("placeholder", message=label)
        while self.keys.read() != "enter":
            pass

    def menu(self) -> None:
        while self.running:
            self.redraw("menu")
            key = self.keys.read()
            if key == "up":
                self.selected = (self.selected - 1) % len(MENU)
            elif key == "down":
                self.selected = (self.selected + 1) % len(MENU)
            elif key == "enter":
                MENU[self.selected][1](self)
            elif key is not None and key in "123456":
                self.selected = int(key) - 1
                MENU[self.selected][1](self)

    def run(self) -> None:
        with Live(
            self.frame("intro", visible_logo_lines=0, prompt_visible=False),
            console=self.console,
            screen=True,
            auto_refresh=False,
        ) as live:
            self.live = live
            try:
                self.intro()
                self.menu()
            finally:
                self.live = None


def main() -> int:
    console = make_console()
    try:
        with KeyReader() as keys:
            TitleScreen(console, keys).run()
    except KeyboardInterrupt:
        pass
    except NonInteractiveTerminalError as error:
        console.print(f"[bold red]Error:[/] {error}")
        return 1
    console.clear()
    console.print(Text("Thanks for playing Hoops Dynasty!", style=GOLD))
    return 0
