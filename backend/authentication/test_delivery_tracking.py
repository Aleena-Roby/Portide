import datetime
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from authentication.models import (
    Login,
    User,
    ShippingCompany,
    Vessel,
    VesselArrivalRequest,
    Cargo,
    Port,
    Container,
    Truck,
    Driver,
    Gate,
    GatePass,
    GatePassContainer,
    ContainerTrackingEvent,
    AuditLog
)

class DeliveryTrackingTestCase(APITestCase):
    def setUp(self):
        # 1. Create or get Ports
        self.origin_port, _ = Port.objects.get_or_create(
            port_code='SGSIN',
            defaults={'port_name': 'Port of Singapore', 'port_country': 'Singapore'}
        )
        self.dest_port, _ = Port.objects.get_or_create(
            port_code='INCOK',
            defaults={'port_name': 'Port of Cochin', 'port_country': 'India'}
        )

        # 2. Shipping Company
        self.company, _ = ShippingCompany.objects.get_or_create(
            shipping_company_license_number='LIC-OEL-DELIV-99',
            defaults={
                'shipping_company_name': 'Oceanic Express Line Delivery',
                'shipping_company_email': 'agent_deliv@oceanic.com',
                'shipping_company_phone': '+919876543210',
                'shipping_company_address': 'Marine Drive, Cochin',
                'shipping_company_jurisdiction': 'Cochin Port Trust',
                'shipping_company_status': 'ACTIVE'
            }
        )

        # 3. Logins and Users
        self.admin_login, _ = Login.objects.get_or_create(
            login_email='admin_deliv@portide.local',
            defaults={
                'login_password': 'hashed_password',
                'login_role': 'port_administrator',
                'login_status': 'ACTIVE'
            }
        )
        self.admin_user, _ = User.objects.get_or_create(
            login_id=self.admin_login,
            defaults={'user_full_name': 'Port Admin User', 'user_status': 'ACTIVE'}
        )

        self.gate_login, _ = Login.objects.get_or_create(
            login_email='gate_deliv@portide.local',
            defaults={
                'login_password': 'hashed_password',
                'login_role': 'gate_truck_officer',
                'login_status': 'ACTIVE'
            }
        )
        self.gate_user, _ = User.objects.get_or_create(
            login_id=self.gate_login,
            defaults={'user_full_name': 'Officer Sneha', 'user_status': 'ACTIVE'}
        )

        self.terminal_login, _ = Login.objects.get_or_create(
            login_email='terminal_deliv@portide.local',
            defaults={
                'login_password': 'hashed_password',
                'login_role': 'terminal_logistics_operator',
                'login_status': 'ACTIVE'
            }
        )
        self.terminal_user, _ = User.objects.get_or_create(
            login_id=self.terminal_login,
            defaults={'user_full_name': 'Terminal Operator Roby', 'user_status': 'ACTIVE'}
        )

        self.customs_login, _ = Login.objects.get_or_create(
            login_email='customs_deliv@portide.local',
            defaults={
                'login_password': 'hashed_password',
                'login_role': 'customs_officer',
                'login_status': 'ACTIVE'
            }
        )
        self.customs_user, _ = User.objects.get_or_create(
            login_id=self.customs_login,
            defaults={'user_full_name': 'Customs Officer Feba', 'user_status': 'ACTIVE'}
        )

        self.shipping_login, _ = Login.objects.get_or_create(
            login_email='shipping_deliv@oceanic.com',
            defaults={
                'login_password': 'hashed_password',
                'login_role': 'shipping_company',
                'login_status': 'ACTIVE'
            }
        )
        self.shipping_user, _ = User.objects.get_or_create(
            login_id=self.shipping_login,
            defaults={
                'shipping_company_id': self.company,
                'user_full_name': 'Capt. Oceanic Agent',
                'user_status': 'ACTIVE'
            }
        )

        # 4. Vessel & Arrival Request & Cargo
        self.vessel, _ = Vessel.objects.get_or_create(
            vessel_imo_number='IMO9999888',
            defaults={
                'vessel_shipping_company_id': self.company,
                'vessel_name': 'MV Pacific Express',
                'vessel_type': 'CONTAINER_SHIP',
                'vessel_flag': 'Singapore',
                'vessel_length': 280.00,
                'vessel_draft': 12.50,
                'vessel_capacity': 4500,
                'vessel_status': 'ACTIVE'
            }
        )

        now = timezone.now()
        self.arrival_req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now,
            vessel_arrival_request_requested_departure_at=now + datetime.timedelta(days=2),
            vessel_arrival_request_cargo_type='Consumer Electronics',
            vessel_arrival_request_cargo_quantity=2500.00,
            vessel_arrival_request_status='APPROVED'
        )

        self.cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_req,
            cargo_description='Consumer electronics and hardware',
            cargo_type='CONTAINERIZED',
            cargo_quantity=100.00,
            cargo_unit='TEU',
            cargo_weight=1500.00,
            cargo_origin_port_id=self.origin_port,
            cargo_destination_port_id=self.dest_port,
            cargo_status='COMPLETED'
        )

        # 5. Truck, Driver, Gate
        self.truck, _ = Truck.objects.get_or_create(
            truck_number='DL-01-DELIV-4433',
            defaults={'truck_company_name': 'FastLogistics Transport', 'truck_status': 'ACTIVE'}
        )

        self.driver, _ = Driver.objects.get_or_create(
            driver_license_number='DL-DELIV-552026001',
            defaults={
                'driver_name': 'Sneha Driver',
                'driver_phone': '+919876543219',
                'driver_email': 'driver_deliv@fastlogistics.com',
                'driver_status': 'ACTIVE'
            }
        )

        self.gate, _ = Gate.objects.get_or_create(
            gate_code='GATE-DELIV-01',
            defaults={
                'gate_name': 'Deliv Logistics Exit Gate',
                'gate_type': 'OUTBOUND',
                'gate_is_active': True
            }
        )

        # 6. Container
        self.container, _ = Container.objects.get_or_create(
            container_number='MSCU3456789',
            defaults={
                'container_cargo_id': self.cargo,
                'container_type': '40FT_HC',
                'container_gross_weight': 24.50,
                'container_status': 'RELEASED',
                'container_delivery_status': 'RELEASED',
                'container_delivery_destination': 'Port of Cochin -> Kochi Distribution Facility'
            }
        )

        # Clean prior events for test container if any
        self.container.tracking_events.all().delete()
        GatePassContainer.objects.filter(gate_pass_container_container_id=self.container).delete()

        # Initial RELEASED event
        ContainerTrackingEvent.objects.create(
            tracking_event_container_id=self.container,
            tracking_event_status='RELEASED',
            tracking_event_location='Port Terminal Yard',
            tracking_event_description='Container cleared customs and authorized for gate logistics.',
            tracking_event_updated_by=self.gate_user,
            tracking_event_timestamp=now - datetime.timedelta(hours=5)
        )

        # 7. Gate Pass
        self.gate_pass, _ = GatePass.objects.get_or_create(
            gate_pass_pass_number='GP-TEST-DELIV-9988',
            defaults={
                'gate_pass_movement_number': 'GM-TEST-DELIV-9988',
                'gate_pass_truck_id': self.truck,
                'gate_pass_driver_id': self.driver,
                'gate_pass_gate_id': self.gate,
                'gate_pass_issued_by': self.gate_user,
                'gate_pass_status': 'USED',
                'gate_pass_verification_code': 'VREF-TEST-DELIV-9988',
                'gate_pass_qr_code': 'PORTIDE-GP:GP-TEST-DELIV-9988:VREF-TEST-DELIV-9988',
                'gate_pass_valid_until': now + datetime.timedelta(hours=24),
                'gate_pass_verified_at': now - datetime.timedelta(hours=4),
                'gate_pass_used_at': now - datetime.timedelta(hours=4),
                'gate_pass_remarks': 'Gate verification approved'
            }
        )

        GatePassContainer.objects.get_or_create(
            gate_pass_container_gate_pass_id=self.gate_pass,
            gate_pass_container_container_id=self.container
        )

        ContainerTrackingEvent.objects.create(
            tracking_event_container_id=self.container,
            tracking_event_gate_pass_id=self.gate_pass,
            tracking_event_status='GATE_PASS_GENERATED',
            tracking_event_location=self.gate.gate_name,
            tracking_event_description=f'Digital Gate Pass {self.gate_pass.gate_pass_pass_number} generated.',
            tracking_event_updated_by=self.gate_user,
            tracking_event_timestamp=now - datetime.timedelta(hours=4, minutes=30)
        )

        ContainerTrackingEvent.objects.create(
            tracking_event_container_id=self.container,
            tracking_event_gate_pass_id=self.gate_pass,
            tracking_event_status='PICKED_UP',
            tracking_event_location=self.gate.gate_name,
            tracking_event_description=f'Container picked up by truck {self.truck.truck_number}.',
            tracking_event_updated_by=self.gate_user,
            tracking_event_timestamp=now - datetime.timedelta(hours=4)
        )

        self.container.container_delivery_status = 'PICKED_UP'
        self.container.save(update_fields=['container_delivery_status'])

    def test_public_container_tracking(self):
        """Test safe public tracking endpoint returns Amazon-style order tracking timeline without sensitive PII"""
        url = f'/api/containers/track/?number={self.container.container_number}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json().get('data', {})

        self.assertEqual(data.get('container_number'), 'MSCU3456789')
        self.assertTrue(data.get('is_delivery_stage'))
        self.assertEqual(data.get('current_status'), 'PICKED_UP')
        self.assertIn('picked up', data.get('status_message', '').lower())
        self.assertIn('destination', data)

        # Timeline verification
        timeline = data.get('timeline', [])
        self.assertEqual(len(timeline), 7)
        self.assertEqual(timeline[0]['step'], 'RELEASED')
        self.assertEqual(timeline[0]['status'], 'completed')
        self.assertEqual(timeline[1]['step'], 'GATE_PASS_GENERATED')
        self.assertEqual(timeline[1]['status'], 'completed')
        self.assertEqual(timeline[2]['step'], 'PICKED_UP')
        self.assertEqual(timeline[2]['status'], 'current')
        self.assertEqual(timeline[3]['step'], 'DEPARTED_PORT')
        self.assertEqual(timeline[3]['status'], 'pending')

        # Privacy verification: sensitive fields must not be present in public response
        raw_text = response.content.decode('utf-8')
        self.assertNotIn('driver@fastlogistics.com', raw_text)
        self.assertNotIn('+919876543219', raw_text)
        self.assertNotIn('DL-552026001', raw_text)
        self.assertNotIn('Officer Sneha', raw_text)

    def test_complete_delivery_flow_and_transitions(self):
        """Test full operational sequence: PICKED_UP -> DEPARTED_PORT -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED"""
        container_id = self.container.container_id

        # 1. Gate Officer confirms departure: PICKED_UP -> DEPARTED_PORT
        headers_gate = {
            'HTTP_X_USER_ROLE': 'gate_truck_officer',
            'HTTP_X_USER_ID': str(self.gate_login.login_id),
            'HTTP_X_USER_EMAIL': self.gate_login.login_email
        }
        res_dep = self.client.post(
            f'/api/delivery/containers/{container_id}/confirm-departure/',
            {'location': 'Port Exit Checkpoint Gate 1', 'remarks': 'Vehicle inspected and cleared exit'},
            format='json',
            **headers_gate
        )
        self.assertEqual(res_dep.status_code, status.HTTP_200_OK)
        self.assertEqual(res_dep.json()['data']['current_status'], 'DEPARTED_PORT')

        # 2. Terminal Operator updates: DEPARTED_PORT -> IN_TRANSIT
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }
        res_transit = self.client.post(
            f'/api/delivery/containers/{container_id}/update-status/',
            {
                'target_status': 'IN_TRANSIT',
                'location': 'Transit Corridor NH-66',
                'remarks': 'Container on schedule along National Highway'
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_transit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_transit.json()['data']['current_status'], 'IN_TRANSIT')

        # 3. Terminal Operator updates: IN_TRANSIT -> OUT_FOR_DELIVERY
        res_out = self.client.post(
            f'/api/delivery/containers/{container_id}/update-status/',
            {
                'target_status': 'OUT_FOR_DELIVERY',
                'location': 'Kochi Regional Logistics Center',
                'remarks': 'Dispatched for last-mile delivery to consignee'
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_out.status_code, status.HTTP_200_OK)
        self.assertEqual(res_out.json()['data']['current_status'], 'OUT_FOR_DELIVERY')

        # 4. Terminal Operator confirms final delivery: OUT_FOR_DELIVERY -> DELIVERED
        res_del = self.client.post(
            f'/api/delivery/containers/{container_id}/confirm-delivery/',
            {
                'delivery_location': 'Kochi Distribution Warehouse Bay 4',
                'recipient_name': 'Manager K. Varma',
                'remarks': 'Signed cargo receipt verified with no damage'
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        data_del = res_del.json()['data']
        self.assertEqual(data_del['current_status'], 'DELIVERED')
        self.assertIsNotNone(data_del['delivered_at'])
        self.assertEqual(data_del['delivery_recipient'], 'Manager K. Varma')

        # Verify audit log was recorded
        audit = AuditLog.objects.filter(
            audit_log_category='DELIVERY_TRACKING',
            audit_log_target_id=str(container_id)
        ).first()
        self.assertIsNotNone(audit)

    def test_invalid_transitions_strictly_forbidden(self):
        """Ensure invalid or skipping status transitions are rejected"""
        container_id = self.container.container_id
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        # Current status is PICKED_UP; cannot jump directly to DELIVERED
        res_invalid = self.client.post(
            f'/api/delivery/containers/{container_id}/confirm-delivery/',
            {'delivery_location': 'Direct Jump Facility'},
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)

        # Cannot skip IN_TRANSIT and jump from PICKED_UP to OUT_FOR_DELIVERY
        res_invalid2 = self.client.post(
            f'/api/delivery/containers/{container_id}/update-status/',
            {'target_status': 'OUT_FOR_DELIVERY'},
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_invalid2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid transition', res_invalid2.json().get('message', ''))

    def test_released_container_appears_and_sequential_transitions_audited(self):
        """
        1. Released container automatically appears in Delivery Tracking.
        2. Duplicate tracking records are not created.
        3. Valid sequential transitions: RELEASED -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED.
        4. Invalid transitions and backward steps are rejected.
        5. Every delivery status transition writes an AuditLog entry.
        """
        # Create a new container that has just been released at gate exit
        released_container = Container.objects.create(
            container_number='MSCU9999001',
            container_cargo_id=self.cargo,
            container_type='40FT_DRY',
            container_gross_weight=24.5,
            container_status='RELEASED',
            container_delivery_status='RELEASED',
            container_delivery_location='Gate Exit Checkpoint 3'
        )

        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        # 1. Verify container appears in delivery listing with 'data' envelope and 'results'
        res_list = self.client.get('/api/delivery/containers/', **headers_terminal)
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        res_data = res_list.json()
        self.assertIn('data', res_data)
        self.assertIn('containers', res_data['data'])
        container_numbers = [c['container_number'] for c in res_data['data']['containers']]
        self.assertIn('MSCU9999001', container_numbers)

        # 2. Verify duplicate tracking records are not created
        count_released_events_before = ContainerTrackingEvent.objects.filter(
            tracking_event_container_id=released_container,
            tracking_event_status='RELEASED'
        ).count()
        self.assertEqual(count_released_events_before, 1)

        # Calling the list endpoint again must NOT duplicate tracking events
        self.client.get('/api/delivery/containers/', **headers_terminal)
        count_released_events_after = ContainerTrackingEvent.objects.filter(
            tracking_event_container_id=released_container,
            tracking_event_status='RELEASED'
        ).count()
        self.assertEqual(count_released_events_after, 1)

        cid = released_container.container_id

        # 3. Invalid transition from RELEASED: cannot jump directly to IN_TRANSIT or DELIVERED
        res_skip = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {'target_status': 'IN_TRANSIT'},
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_skip.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Valid step 1: RELEASED -> PICKED_UP
        res_pick = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {'target_status': 'PICKED_UP', 'remarks': 'Picked up by transport truck'},
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_pick.status_code, status.HTTP_200_OK)
        self.assertEqual(res_pick.json()['data']['current_status'], 'PICKED_UP')

        # Verify audit log for PICKED_UP
        audit_pick = AuditLog.objects.filter(
            audit_log_category='DELIVERY_TRACKING',
            audit_log_target_id=str(cid),
            audit_log_description__contains='RELEASED -> PICKED_UP'
        ).first()
        self.assertIsNotNone(audit_pick)

        # 5. Valid step 2: PICKED_UP -> IN_TRANSIT
        res_trans = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {'target_status': 'IN_TRANSIT', 'location': 'NH-66 Highway', 'remarks': 'En route to hub'},
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_trans.status_code, status.HTTP_200_OK)
        self.assertEqual(res_trans.json()['data']['current_status'], 'IN_TRANSIT')

        # 6. Invalid backward step: cannot move IN_TRANSIT -> PICKED_UP
        res_back = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {'target_status': 'PICKED_UP'},
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_back.status_code, status.HTTP_400_BAD_REQUEST)

        # 7. Valid step 3: IN_TRANSIT -> OUT_FOR_DELIVERY
        res_out = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {'target_status': 'OUT_FOR_DELIVERY', 'location': 'Cochin Local Hub', 'remarks': 'Out for final delivery'},
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_out.status_code, status.HTTP_200_OK)
        self.assertEqual(res_out.json()['data']['current_status'], 'OUT_FOR_DELIVERY')

        # 8. Valid step 4: OUT_FOR_DELIVERY -> DELIVERED
        res_del = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {'target_status': 'DELIVERED', 'location': 'Consignee Bay 2', 'remarks': 'Delivered and verified'},
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertEqual(res_del.json()['data']['current_status'], 'DELIVERED')

        # Verify delivered audit log
        audit_del = AuditLog.objects.filter(
            audit_log_category='DELIVERY_TRACKING',
            audit_log_target_id=str(cid),
            audit_log_description__contains='OUT_FOR_DELIVERY -> DELIVERED'
        ).first()
        self.assertIsNotNone(audit_del)

        # 9. No mutations allowed once DELIVERED
        res_after_del = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {'target_status': 'IN_TRANSIT'},
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_after_del.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delivery_exception_and_resumption(self):
        """Test reporting a delivery exception and resuming the delivery lifecycle"""
        container_id = self.container.container_id
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        # Report exception
        res_exc = self.client.post(
            f'/api/delivery/containers/{container_id}/report-exception/',
            {
                'exception_reason': 'Delivery Delayed',
                'location': 'NH-66 Highway Checkpoint',
                'remarks': 'Traffic congestion due to heavy monsoon rain'
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_exc.status_code, status.HTTP_200_OK)
        self.assertEqual(res_exc.json()['data']['current_status'], 'DELIVERY_EXCEPTION')
        self.assertTrue(res_exc.json()['data']['has_active_exception'])

        # Verify historical events preserved
        events_count = ContainerTrackingEvent.objects.filter(tracking_event_container_id=self.container).count()
        self.assertGreaterEqual(events_count, 4)

        # Resume delivery to OUT_FOR_DELIVERY
        res_resume = self.client.post(
            f'/api/delivery/containers/{container_id}/update-status/',
            {
                'target_status': 'OUT_FOR_DELIVERY',
                'location': 'Local Hub Depot',
                'remarks': 'Traffic cleared, vehicle resumed delivery route'
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_resume.status_code, status.HTTP_200_OK)
        self.assertEqual(res_resume.json()['data']['current_status'], 'OUT_FOR_DELIVERY')

    def test_customs_officer_denied_delivery_mutations(self):
        """Customs Officer must not have responsibility or access to update delivery tracking"""
        container_id = self.container.container_id
        headers_customs = {
            'HTTP_X_USER_ROLE': 'customs_officer',
            'HTTP_X_USER_ID': str(self.customs_login.login_id),
            'HTTP_X_USER_EMAIL': self.customs_login.login_email
        }

        res = self.client.post(
            f'/api/delivery/containers/{container_id}/update-status/',
            {'target_status': 'IN_TRANSIT'},
            format='json',
            **headers_customs
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_delivery_container_list_and_summary_cards(self):
        """Ensure dashboard list endpoint returns accurate summary counts and filterable items"""
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        res = self.client.get('/api/delivery/containers/', **headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIn('summary', data)
        self.assertIn('results', data)
        self.assertGreaterEqual(data['summary']['total'], 1)
        self.assertGreaterEqual(data['summary']['picked_up'], 1)

        # Filter by status
        res_filtered = self.client.get('/api/delivery/containers/?status=PICKED_UP', **headers_terminal)
        self.assertEqual(res_filtered.status_code, status.HTTP_200_OK)
        self.assertTrue(all(item['current_status'] == 'PICKED_UP' for item in res_filtered.json()['results']))

        # Search by container number
        res_search = self.client.get('/api/delivery/containers/?search=MSCU3456789', **headers_terminal)
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_search.json()['results']), 1)

    def test_expected_and_final_delivery_fields(self):
        """Verify expected and final delivery datetime and destination fields in detail endpoint"""
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }
        cid = self.container.container_id

        # 1. Container without assigned expected delivery schedule
        self.container.container_expected_delivery_date = None
        self.container.container_delivery_destination = ''
        self.container.save()

        res_detail_no_sched = self.client.get(f'/api/delivery/containers/{cid}/', **headers_terminal)
        self.assertEqual(res_detail_no_sched.status_code, status.HTTP_200_OK)
        data = res_detail_no_sched.json()['data']
        self.assertIsNone(data.get('expected_delivery_datetime'))
        self.assertIsNone(data.get('actual_delivery_datetime'))
        self.assertEqual(data.get('current_status'), 'PICKED_UP')

        # 2. Container with expected delivery schedule and destination assigned
        future_dt = timezone.now() + timezone.timedelta(days=2)
        res_update = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {
                'target_status': 'IN_TRANSIT',
                'location': 'Transit Corridor NH-66',
                'destination': 'Kochi Distribution Facility',
                'expected_delivery_date': future_dt.isoformat(),
                'remarks': 'Scheduled inland delivery corridor movement'
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        res_detail_exp = self.client.get(f'/api/delivery/containers/{cid}/', **headers_terminal)
        self.assertEqual(res_detail_exp.status_code, status.HTTP_200_OK)
        data_exp = res_detail_exp.json()['data']
        self.assertIsNotNone(data_exp.get('expected_delivery_datetime'))
        self.assertEqual(data_exp.get('expected_delivery_destination'), 'Kochi Distribution Facility')
        self.assertIsNone(data_exp.get('actual_delivery_datetime'))
        self.assertEqual(data_exp.get('current_status'), 'IN_TRANSIT')

        # Advance to OUT_FOR_DELIVERY
        res_out = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {
                'target_status': 'OUT_FOR_DELIVERY',
                'location': 'Kochi Regional Hub',
                'remarks': 'Out for final consignee delivery'
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_out.status_code, status.HTTP_200_OK)

        # 3. Terminal Operator confirms final delivery: OUT_FOR_DELIVERY -> DELIVERED
        res_del = self.client.post(
            f'/api/delivery/containers/{cid}/confirm-delivery/',
            {
                'delivery_location': 'Kochi Distribution Facility',
                'recipient_name': 'Warehouse Supervisor J. Paul',
                'remarks': 'Consignee verified and accepted container seal'
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)

        res_detail_del = self.client.get(f'/api/delivery/containers/{cid}/', **headers_terminal)
        self.assertEqual(res_detail_del.status_code, status.HTTP_200_OK)
        data_del = res_detail_del.json()['data']
        self.assertEqual(data_del.get('current_status'), 'DELIVERED')
        self.assertIsNotNone(data_del.get('actual_delivery_datetime'))
        self.assertEqual(data_del.get('final_delivery_destination'), 'Kochi Distribution Facility')
        self.assertEqual(data_del.get('delivery_recipient'), 'Warehouse Supervisor J. Paul')

    def test_tracking_event_timestamp_is_automatic_and_ignores_manual_input(self):
        """User cannot manually forge actual event timestamp; backend generates server time and records auth user"""
        cid = self.container.container_id
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        # Attempt to pass a forged manual past timestamp
        fake_manual_timestamp = "2020-01-01T00:00:00Z"
        before_call = timezone.now()

        res = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {
                'target_status': 'IN_TRANSIT',
                'location': 'Transit Route Corridor',
                'remarks': 'Testing automatic server timestamping',
                'timestamp': fake_manual_timestamp,
                'event_time': fake_manual_timestamp,
                'actual_time': fake_manual_timestamp
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        after_call = timezone.now()

        # Find the newly created event
        new_event = ContainerTrackingEvent.objects.filter(
            tracking_event_container_id=self.container,
            tracking_event_status='IN_TRANSIT'
        ).latest('tracking_event_id')

        # Verify timestamp was generated automatically by server and NOT forged
        self.assertGreaterEqual(new_event.tracking_event_timestamp, before_call - datetime.timedelta(seconds=5))
        self.assertLessEqual(new_event.tracking_event_timestamp, after_call + datetime.timedelta(seconds=5))
        self.assertNotEqual(new_event.tracking_event_timestamp.year, 2020)

        # Verify updated_by comes from authenticated user
        self.assertEqual(new_event.tracking_event_updated_by, self.terminal_user)

    def test_expected_delivery_is_optional_and_preserved_when_unspecified(self):
        """Expected delivery schedule is optional and preserved when status updates do not specify it"""
        cid = self.container.container_id
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        # Assign an initial expected delivery schedule
        initial_expected = timezone.now() + datetime.timedelta(days=3)
        self.container.container_expected_delivery_date = initial_expected
        self.container.save(update_fields=['container_expected_delivery_date'])

        # Advance status to IN_TRANSIT without passing expected_delivery_date
        res = self.client.post(
            f'/api/delivery/containers/{cid}/update-status/',
            {
                'target_status': 'IN_TRANSIT',
                'location': 'NH-66 Highway Route'
            },
            format='json',
            **headers_terminal
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Refresh container and ensure expected delivery schedule is preserved
        self.container.refresh_from_db()
        self.assertIsNotNone(self.container.container_expected_delivery_date)
        self.assertEqual(
            self.container.container_expected_delivery_date.isoformat(),
            initial_expected.isoformat()
        )

    def test_read_endpoints_are_strictly_idempotent_no_duplicate_events(self):
        """Refreshing tracking views or viewing container details must not create duplicate tracking events"""
        cid = self.container.container_id
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        initial_count = ContainerTrackingEvent.objects.filter(tracking_event_container_id=self.container).count()

        # Call list endpoint multiple times
        for _ in range(3):
            res_list = self.client.get('/api/delivery/containers/', **headers_terminal)
            self.assertEqual(res_list.status_code, status.HTTP_200_OK)

        # Call detail endpoint multiple times
        for _ in range(3):
            res_detail = self.client.get(f'/api/delivery/containers/{cid}/', **headers_terminal)
            self.assertEqual(res_detail.status_code, status.HTTP_200_OK)

        # Call public track endpoint multiple times
        for _ in range(3):
            res_track = self.client.get(f'/api/containers/track/?number={self.container.container_number}')
            self.assertEqual(res_track.status_code, status.HTTP_200_OK)

        # Event count must remain unchanged
        final_count = ContainerTrackingEvent.objects.filter(tracking_event_container_id=self.container).count()
        self.assertEqual(initial_count, final_count)

    def test_safe_date_formatting_for_null_or_legacy_timestamps(self):
        """Null or legacy timestamps never produce 'Invalid Date' and display safe fallback"""
        from authentication.serializers import ContainerTrackingEventSerializer, ContainerDeliveryDetailSerializer

        # Create a historical legacy event with a null timestamp
        legacy_event = ContainerTrackingEvent.objects.create(
            tracking_event_container_id=self.container,
            tracking_event_status='RELEASED',
            tracking_event_location='Historical Yard',
            tracking_event_timestamp=timezone.now()
        )
        # Directly simulate legacy missing timestamp in memory on model instance
        legacy_event.tracking_event_timestamp = None

        serializer = ContainerTrackingEventSerializer(legacy_event)
        data = serializer.data
        self.assertNotIn("Invalid", str(data.get('timestamp_formatted')))
        self.assertEqual(data.get('timestamp_formatted'), "Date/time unavailable")
        self.assertIsNone(data.get('timestamp'))

        # Check detail serializer handles container without expected delivery schedule
        self.container.container_expected_delivery_date = None
        self.container.save(update_fields=['container_expected_delivery_date'])
        detail_serializer = ContainerDeliveryDetailSerializer(self.container)
        detail_data = detail_serializer.data
        self.assertIsNone(detail_data.get('expected_delivery_date'))
        self.assertIsNone(detail_data.get('expected_delivery_date_formatted'))

    def test_kolkata_timezone_formatting_ist(self):
        """Timestamps in UTC are properly converted to Asia/Kolkata (IST) for display"""
        import datetime
        from authentication.serializers import format_datetime_ist

        # 2026-10-06 18:47:00 UTC -> in IST (+05:30) is 2026-10-07 00:17:00 (12:17 AM)
        utc_dt = datetime.datetime(2026, 10, 6, 18, 47, 0, tzinfo=datetime.timezone.utc)
        formatted = format_datetime_ist(utc_dt)
        self.assertEqual(formatted, "07 Oct 2026, 12:17 AM")

    def test_delivery_summary_fields_for_delivered_container(self):
        """Delivered container detail serializer provides all required summary fields"""
        from authentication.serializers import ContainerDeliveryDetailSerializer
        import datetime

        # Deliver the container
        del_time = datetime.datetime(2026, 10, 6, 18, 47, 0, tzinfo=datetime.timezone.utc)
        self.container.container_delivery_status = 'DELIVERED'
        self.container.container_delivered_at = del_time
        self.container.container_delivered_by = self.terminal_user
        self.container.container_delivery_location = 'Consignee Distribution Center'
        self.container.container_expected_delivery_date = datetime.datetime(2026, 10, 6, 12, 0, 0, tzinfo=datetime.timezone.utc)
        self.container.save()

        serializer = ContainerDeliveryDetailSerializer(self.container)
        data = serializer.data

        self.assertEqual(data.get('current_status'), 'DELIVERED')
        self.assertEqual(data.get('delivered_at_formatted'), '07 Oct 2026, 12:17 AM')
        self.assertEqual(data.get('delivered_by_name'), self.terminal_user.user_full_name.title())
        self.assertEqual(data.get('delivered_by_role'), 'Terminal & Logistics Operator')
        self.assertEqual(data.get('delivery_location'), 'Consignee Distribution Center')
        self.assertEqual(data.get('expected_delivery_date_formatted'), '06 Oct 2026, 05:30 PM')
        self.assertIsNotNone(data.get('vessel_name'))
        self.assertIsNotNone(data.get('cargo_description'))

    def test_non_delivered_container_does_not_have_actual_delivery(self):
        """Non-delivered containers do not populate actual delivery timestamps"""
        from authentication.serializers import ContainerDeliveryDetailSerializer

        self.container.container_delivery_status = 'IN_TRANSIT'
        self.container.container_delivered_at = None
        self.container.save()

        serializer = ContainerDeliveryDetailSerializer(self.container)
        data = serializer.data

        self.assertEqual(data.get('current_status'), 'IN_TRANSIT')
        self.assertIsNone(data.get('actual_delivery_datetime'))
        self.assertIsNone(data.get('delivered_at_formatted'))

    def test_delivered_container_cannot_change_status(self):
        """Container in DELIVERED status cannot be changed to another status"""
        from authentication.models import ContainerTrackingEvent
        import datetime

        self.container.container_delivery_status = 'DELIVERED'
        self.container.container_delivered_at = datetime.datetime(2026, 10, 6, 18, 47, 0, tzinfo=datetime.timezone.utc)
        self.container.save()

        initial_event_count = ContainerTrackingEvent.objects.filter(tracking_event_container_id=self.container).count()

        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        url = f"/api/delivery/containers/{self.container.container_id}/update-status/"
        response = self.client.post(url, {
            "target_status": "IN_TRANSIT",
            "location": "Attempted Regression"
        }, format='json', **headers_terminal)

        self.assertEqual(response.status_code, 400)
        self.assertIn("already DELIVERED", response.data.get('message', ''))

        final_event_count = ContainerTrackingEvent.objects.filter(tracking_event_container_id=self.container).count()
        self.assertEqual(initial_event_count, final_event_count)

    def test_delivery_tracking_strictly_excludes_export_containers(self):
        """Delivery tracking worklist and KPIs must only include IMPORT containers, excluding EXPORT"""
        now = timezone.now()

        # Create an EXPORT cargo
        export_cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_req,
            cargo_origin_port_id=self.origin_port,
            cargo_destination_port_id=self.dest_port,
            cargo_type='CONTAINERIZED',
            cargo_description='Outbound Export Spices and Tea',
            cargo_quantity=50.0,
            cargo_unit='TEU',
            cargo_weight=600.0,
            cargo_direction='EXPORT',
            cargo_status='DEPARTED'
        )

        export_container = Container.objects.create(
            container_cargo_id=export_cargo,
            container_number='EXPU9988776',
            container_type='40FT_HC',
            container_gross_weight=20.0,
            container_status='LOADED',
            container_delivery_status='RELEASED'
        )

        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        res = self.client.get('/api/delivery/containers/', **headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        containers = res.json().get('data', {}).get('containers', [])
        container_numbers = [c['container_number'] for c in containers]

        # Ensure export container is excluded
        self.assertNotIn('EXPU9988776', container_numbers)
        # Ensure our import container is present
        self.assertIn(self.container.container_number, container_numbers)

    def test_update_delivery_destination_address_success(self):
        """Directly update final delivery destination address without modifying cargo registration or forcing status change"""
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        cid = self.container.container_id
        url = f"/api/delivery/containers/{cid}/update-address/"

        new_addr = "Consignee Warehouse, Plot 14, Kalamassery Industrial Estate, Kochi, Kerala - 683104"
        new_recip = "Eastern Maritime Imports Pvt Ltd"

        res = self.client.post(url, {
            'destination_address': new_addr,
            'recipient_name': new_recip
        }, format='json', **headers_terminal)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json().get('data', {})
        self.assertEqual(data.get('destination'), new_addr)
        self.assertEqual(data.get('container_delivery_recipient'), new_recip)

        # Verify DB persistence
        self.container.refresh_from_db()
        self.assertEqual(self.container.container_delivery_destination, new_addr)
        self.assertEqual(self.container.container_delivery_recipient, new_recip)

        # Verify Audit Log
        audit = AuditLog.objects.filter(
            audit_log_category='DELIVERY_TRACKING',
            audit_log_target_id=str(cid),
            audit_log_description__contains='Updated delivery address'
        ).first()
        self.assertIsNotNone(audit)

    def test_update_delivery_address_validation(self):
        """Updating delivery address requires a valid non-empty destination address"""
        headers_terminal = {
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.terminal_login.login_id),
            'HTTP_X_USER_EMAIL': self.terminal_login.login_email
        }

        cid = self.container.container_id
        url = f"/api/delivery/containers/{cid}/update-address/"

        # Missing or blank address
        res = self.client.post(url, {'destination_address': '   '}, format='json', **headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_destination_returns_none_instead_of_fake_string(self):
        """When destination address is not provided, serializer returns None so frontend can display fallback message"""
        from authentication.serializers import ContainerDeliveryListSerializer

        self.container.container_delivery_destination = ''
        self.container.save(update_fields=['container_delivery_destination'])

        serializer = ContainerDeliveryListSerializer(self.container)
        data = serializer.data
        self.assertIsNone(data.get('destination'))
        self.assertIsNone(data.get('container_delivery_destination'))

    def test_physical_separation_of_yard_gate_and_destination(self):
        """Yard location, gate exit checkpoint, and final delivery destination are stored and returned separately"""
        from authentication.serializers import ContainerDeliveryListSerializer

        self.container.container_delivery_destination = "Final Warehouse Hub"
        self.container.container_delivery_location = "Gate 1 Exit Checkpoint"
        self.container.save()

        serializer = ContainerDeliveryListSerializer(self.container)
        data = serializer.data

        self.assertEqual(data.get('destination'), "Final Warehouse Hub")
        self.assertEqual(data.get('container_delivery_location'), "Gate 1 Exit Checkpoint")
        self.assertNotEqual(data.get('destination'), data.get('container_delivery_location'))




