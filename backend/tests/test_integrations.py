from fastapi.testclient import TestClient

from main import app


def test_integration_status_endpoint():
    client = TestClient(app)
    r = client.get("/api/integrations/status")
    assert r.status_code == 200
    body = r.json()
    assert "sources" in body
    assert "logs" in body


def test_whatsapp_webhook_ingests_message():
    client = TestClient(app)
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "contacts": [{"wa_id": "999", "profile": {"name": "Unit Test"}}],
                            "messages": [
                                {
                                    "id": "wamid.test.integration",
                                    "from": "999",
                                    "timestamp": "1",
                                    "type": "text",
                                    "text": {"body": "integration test message"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }
    r = client.post("/api/integrations/whatsapp/webhook", json=payload)
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_google_sync_requires_connection():
    client = TestClient(app)
    r = client.post("/api/integrations/sync-now", json={"provider": "gmail"})
    # On unconfigured env this should fail gracefully, not crash.
    assert r.status_code in (400, 500)

