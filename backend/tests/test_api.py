from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_score_video_endpoint() -> None:
    payload = {
        'topic': 'Physics',
        'subtopic': "Newton's Laws",
        'goal': 'problem solving',
        'syllabus_keywords': ['force', 'inertia'],
        'video_title': "Newton's First Law Inertia Explained",
        'video_channel': 'Study Academy',
        'video_description': 'Examples and conceptual explanation'
    }
    response = client.post('/score-video', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 'score' in data
    assert data['label'] in {'relevant', 'borderline', 'irrelevant'}
    assert data['model_used'] in {'tfidf', 'sentence-transformers'}
