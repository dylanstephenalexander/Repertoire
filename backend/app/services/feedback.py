from app.models.feedback import AnalysisLine, Feedback

ALTERNATIVE_THRESHOLD_CP = 50
BLUNDER_THRESHOLD_CP = 200


def quality_from_cp_loss(cp_loss: int) -> str:
    if cp_loss <= ALTERNATIVE_THRESHOLD_CP:
        return "alternative"
    if cp_loss >= BLUNDER_THRESHOLD_CP:
        return "blunder"
    return "mistake"


def build_correct_feedback(move_san: str) -> Feedback:
    return Feedback(
        quality="correct",
        explanation=f"{move_san} is the mainline move.",
    )


def build_alternative_feedback(
    played_san: str,
    mainline_san: str,
    cp_loss: int,
    lines: list[AnalysisLine] | None = None,
    explanation: str | None = None,
) -> Feedback:
    return Feedback(
        quality="alternative",
        explanation=explanation or f"That works! The main line was {mainline_san}, but {played_san} is fine too.",
        centipawn_loss=cp_loss,
        lines=lines,
        llm_explanation=explanation is not None,
    )


def build_mistake_feedback(
    played_san: str,
    best_san: str,
    cp_loss: int,
    lines: list[AnalysisLine] | None = None,
    explanation: str | None = None,
) -> Feedback:
    quality = quality_from_cp_loss(cp_loss)
    if explanation:
        template = explanation
    elif quality == "blunder":
        template = f"{played_san} is a blunder (-{cp_loss} cp). Best was {best_san}."
    else:
        template = f"{played_san} is a mistake (-{cp_loss} cp). Best was {best_san}."
    return Feedback(
        quality=quality,
        explanation=template,
        centipawn_loss=cp_loss,
        lines=lines,
        llm_explanation=explanation is not None,
    )
