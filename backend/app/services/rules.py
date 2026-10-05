from typing import Any, Dict, List
import simpleeval
from simpleeval import SimpleEval


def eval_rule_safe(condition: str, context: Dict[str, Any]) -> bool:
    """
    Safely evaluate a rule condition without using python eval/exec.
    Examples of condition:
      - venue != None and mode != 'Online'
      - hasExpenses == True
      - hasPrizes == True
      - participants > 50
    """
    if not condition or not condition.strip():
        return True

    # Normalize common keywords
    clean = condition.strip()
    clean = clean.replace(" is present", " != None").replace(" is not present", " == None")

    s = SimpleEval()
    s.names = {
        "None": None,
        "true": True,
        "false": False,
        "True": True,
        "False": False,
        **context,
    }
    s.functions = {
        "len": len,
        "str": str,
        "int": lambda x: int(x) if x is not None else 0,
    }

    try:
        result = s.eval(clean)
        return bool(result)
    except Exception:
        # Fallback heuristic if expression is informal (e.g. "venue is present")
        if "venue" in clean and "None" in clean:
            return context.get("venue") is not None and context.get("mode") != "Online"
        if "hasExpenses" in clean:
            return bool(context.get("hasExpenses"))
        if "hasPrizes" in clean:
            return bool(context.get("hasPrizes"))
        return False
