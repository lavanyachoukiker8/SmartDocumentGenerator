import logging
import re
from typing import Any, Dict, Optional, Tuple
from simpleeval import SimpleEval

logger = logging.getLogger(__name__)


def normalize_condition(condition: str) -> str:
    clean = condition.strip()

    # Convert "is present" / "is not present" / "is empty" / "is not empty"
    # Examples:
    #   "venue is present" -> "(venue is not None and venue != '')"
    #   "venue is empty" -> "(venue is None or venue == '')"
    clean = re.sub(
        r"(\b[a-zA-Z_]\w*\b)\s+is\s+not\s+present\b",
        r"(\1 is None or \1 == '')",
        clean,
        flags=re.IGNORECASE,
    )
    clean = re.sub(
        r"(\b[a-zA-Z_]\w*\b)\s+is\s+present\b",
        r"(\1 is not None and \1 != '')",
        clean,
        flags=re.IGNORECASE,
    )
    clean = re.sub(
        r"(\b[a-zA-Z_]\w*\b)\s+is\s+not\s+empty\b",
        r"(\1 is not None and \1 != '')",
        clean,
        flags=re.IGNORECASE,
    )
    clean = re.sub(
        r"(\b[a-zA-Z_]\w*\b)\s+is\s+empty\b",
        r"(\1 is None or \1 == '')",
        clean,
        flags=re.IGNORECASE,
    )

    return clean


class DefaultingDict(dict):
    def __getitem__(self, key):
        if key in self:
            return super().__getitem__(key)
        return None


def eval_rule_safe(condition: str, context: Dict[str, Any]) -> bool:
    """
    Safely evaluate a rule condition without python eval/exec.
    Returns bool. Logs bad expressions with a warning.
    NO heuristic fallback.
    """
    if not condition or not condition.strip():
        return True

    normalized = normalize_condition(condition)

    s = SimpleEval()
    s.names = DefaultingDict({
        "None": None,
        "true": True,
        "false": False,
        "True": True,
        "False": False,
        **context,
    })
    s.functions = {
        "len": len,
        "str": str,
        "int": lambda x: int(x) if x is not None and str(x).isdigit() else 0,
        "float": lambda x: float(x) if x is not None else 0.0,
    }

    try:
        result = s.eval(normalized)
        return bool(result)
    except Exception as e:
        err_msg = f"Bad rule expression '{condition}': {type(e).__name__} ({str(e)})"
        logger.warning(err_msg)
        return False


def validate_rule_condition(condition: str) -> Optional[str]:
    """
    Validates a rule condition expression syntax.
    Returns error string if invalid, None if valid.
    """
    if not condition or not condition.strip():
        return None

    normalized = normalize_condition(condition)
    s = SimpleEval()
    s.names = DefaultingDict({
        "None": None,
        "true": True,
        "false": False,
        "True": True,
        "False": False,
    })
    s.functions = {"len": len, "str": str, "int": lambda x: 0, "float": lambda x: 0.0}

    try:
        s.eval(normalized)
        return None
    except Exception as e:
        return f"Invalid rule expression '{condition}': {type(e).__name__} ({str(e)})"

