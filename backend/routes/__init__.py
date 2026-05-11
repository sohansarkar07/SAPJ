from fastapi import APIRouter
from .core import router as core_router
from .ngo import router as ngo_router
from .mentor import router as mentor_router
from .agency import router as agency_router
from .study import router as study_router
from .integrations import router as integrations_router

api_router = APIRouter()

api_router.include_router(core_router, tags=["core"])
api_router.include_router(ngo_router, tags=["ngo"])
api_router.include_router(mentor_router, tags=["mentor"])
api_router.include_router(agency_router, tags=["agency"])
api_router.include_router(study_router, tags=["study"])
api_router.include_router(integrations_router, prefix="/integrations", tags=["integrations"])
