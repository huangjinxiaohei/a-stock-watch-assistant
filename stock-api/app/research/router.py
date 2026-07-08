from __future__ import annotations

from fastapi import APIRouter

from app.research.schemas import ResearchReportRequest, ResearchReportResponse
from app.research.service import ResearchReportService


router = APIRouter(tags=["research"])
service = ResearchReportService()


@router.post("/research/reports", response_model=ResearchReportResponse)
def create_research_report(request: ResearchReportRequest) -> ResearchReportResponse:
    return service.generate(request)
