import uuid
from datetime import datetime,timedelta,timezone
from fastapi.testclient import TestClient
from main import app
import database,models
client=TestClient(app)

def account(coach=False,verified=True):
    data=client.post('/api/v1/auth/signup',json={'email':f'qa-coach-{uuid.uuid4().hex}@tests.example.com','password':'Booking-test-123!','display_name':'Test coach' if coach else 'Test member'}).json()
    with database.SessionLocal() as db:
        row=db.get(models.User,data['user_id']);row.email_verified=verified
        if coach:row.role=models.UserRole.professional
        db.commit()
    return data['user_id'],{'Authorization':'Bearer '+data['access_token']}

def slot(headers,offset=1):
    start=(datetime.now(timezone.utc)+timedelta(days=offset)).replace(second=0,microsecond=0).isoformat()
    response=client.post('/api/v1/coaching/slots',headers=headers,json={'starts_at':start,'minutes':30});assert response.status_code==201,response.text
    return response.json()

def test_publish_book_reschedule_cancel_releases_inventory_and_isolates_accounts():
    coach_id,coach=account(True);_,first=account();_,other=account();one=slot(coach);two=slot(coach,2)
    catalog=client.get('/api/v1/coaching/coaches',headers=first).json();assert any(row['id']==coach_id for row in catalog['coaches']);assert 'email' not in str(catalog)
    booking=client.post('/api/v1/coaching/bookings',headers=first,json={'slot_id':one['id']});assert booking.status_code==201
    identifier=booking.json()['id']
    assert client.post('/api/v1/coaching/bookings',headers=other,json={'slot_id':one['id']}).status_code==409
    assert client.get('/api/v1/coaching/bookings',headers=other).json()['bookings']==[]
    assert client.delete('/api/v1/coaching/bookings/'+identifier,headers=other).status_code==404
    assert client.patch('/api/v1/coaching/bookings/'+identifier,headers=other,json={'slot_id':two['id']}).status_code==404
    assert client.delete('/api/v1/coaching/slots/'+one['id'],headers=coach).status_code==409
    assert client.patch('/api/v1/coaching/bookings/'+identifier,headers=first,json={'slot_id':two['id']}).status_code==200
    available=client.get('/api/v1/coaching/slots',headers=first,params={'coach_id':coach_id}).json()['slots'];assert [row['id'] for row in available]==[one['id']]
    hosted=client.get('/api/v1/coaching/bookings',headers=coach).json()['bookings'];assert hosted[0]['member_name']=='Test member' and hosted[0]['hosting']
    assert client.delete('/api/v1/coaching/bookings/'+identifier,headers=coach).status_code==200
    assert client.post('/api/v1/coaching/bookings',headers=other,json={'slot_id':two['id']}).status_code==201
    assert client.delete('/api/v1/users/account',headers=coach).status_code==200
    assert all(row['status']=='cancelled' for row in client.get('/api/v1/coaching/bookings',headers=other).json()['bookings'])
    assert all(row['id']!=coach_id for row in client.get('/api/v1/coaching/coaches',headers=first).json()['coaches'])

def test_rejects_unapproved_publish_unverified_booking_self_booking_and_overlap():
    _,member=account();_,unverified=account(verified=False);coach_id,coach=account(True);one=slot(coach)
    assert client.post('/api/v1/coaching/slots',headers=member,json={'starts_at':one['starts_at'],'minutes':30}).status_code==403
    assert client.post('/api/v1/coaching/bookings',headers=unverified,json={'slot_id':one['id']}).status_code==403
    assert client.post('/api/v1/coaching/bookings',headers=coach,json={'slot_id':one['id']}).status_code==422
    assert client.post('/api/v1/coaching/slots',headers=coach,json={'starts_at':one['starts_at'],'minutes':60}).status_code==409
    assert client.post('/api/v1/coaching/slots',headers=coach,json={'starts_at':'2026-01-01T12:00:00','minutes':30}).status_code==422
    assert client.delete('/api/v1/coaching/slots/'+one['id'],headers=member).status_code==403
    assert client.delete('/api/v1/coaching/slots/'+one['id'],headers=coach).status_code==200
    assert client.post('/api/v1/coaching/bookings',headers=member,json={'slot_id':one['id']}).status_code==409
