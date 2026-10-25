# 4.5 TABLE DESIGN

This section documents the prioritized database table schemas for the **PORTIDE (Maritime Port Operations Intelligence Platform)** PostgreSQL database.

---

### 1. tbl_login
**Primary key:** `login_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | login_id | BigInt (20) | Primary Key, Auto_increment | Unique system identifier for authentication credentials. |
| 2 | login_email | Varchar (255) | Unique, Not Null | User's registered corporate email address used for login authentication. |
| 3 | login_password | Varchar (255) | Not Null | Cryptographically salted and bcrypt-hashed password string. |
| 4 | login_role | Varchar (50) | Not Null | Platform persona classification (`port_administrator`, `customs_officer`, `shipping_company`, etc.). |
| 5 | login_status | Varchar (30) | Not Null | Account approval lifecycle state (`PENDING`, `ACTIVE`, `SUSPENDED`, `REJECTED`). |
| 6 | login_is_active | Boolean | Not Null | Flag indicating whether the account is currently authorized to access the system. |
| 7 | login_created_at | Timestamp | Default Current_Timestamp | Audit timestamp recording when the login credential was created. |
| 8 | login_updated_at | Timestamp | Default Current_Timestamp | Audit timestamp recording the most recent credential or status modification. |

---

### 2. tbl_user
**Primary key:** `user_id`  
**Foreign key:** `login_id` references table `tbl_login`, `shipping_company_id` references table `tbl_shipping_company`, `department_id` references table `tbl_department`, `role_id` references table `tbl_role`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | user_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for internal port personnel and staff profile records. |
| 2 | login_id | BigInt (20) | Foreign Key, Unique, Not Null | References `login_id` of `tbl_login` establishing one-to-one credential linkage. |
| 3 | shipping_company_id | BigInt (20) | Foreign Key, Null | References `shipping_company_id` of `tbl_shipping_company` for shipping agent accounts. |
| 4 | department_id | BigInt (20) | Foreign Key, Null | References `department_department_id` of `tbl_department`. |
| 5 | role_id | BigInt (20) | Foreign Key, Null | References `role_role_id` of `tbl_role`. |
| 6 | user_full_name | Varchar (150) | Not Null | Officer's full legal name. |
| 7 | user_phone | Varchar (50) | Null | Officer's verified telephone contact number. |
| 8 | user_employee_id | Varchar (50) | Unique, Null | Official port authority employee badge or credential ID. |
| 9 | user_department | Varchar (100) | Null | Assigned functional division (e.g., Marine Operations, Customs Clearance, Yard Master). |
| 10 | user_designation | Varchar (100) | Null | Professional job title held by the officer. |
| 11 | user_status | Varchar (30) | Not Null | Profile operational status (`ACTIVE`, `PENDING`, `SUSPENDED`). |
| 12 | user_must_change_password | Boolean | Not Null | Security compliance flag enforcing password change upon first administrative login. |
| 13 | user_created_at | Timestamp | Default Current_Timestamp | Timestamp when the user profile record was created. |
| 14 | user_updated_at | Timestamp | Default Current_Timestamp | Timestamp when the profile record was last updated. |

---

### 3. tbl_role
**Primary key:** `role_role_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | role_role_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for role-based access control (RBAC) definitions. |
| 2 | role_role_name | Varchar (100) | Unique, Not Null | Human-readable persona label (e.g., Port Administrator, Customs Officer). |
| 3 | role_role_code | Varchar (50) | Unique, Not Null | Machine-readable system role code (e.g., `port_operations_officer`). |
| 4 | role_created_at | Timestamp | Default Current_Timestamp | Timestamp when the access role was created. |

---

### 4. tbl_department
**Primary key:** `department_department_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | department_department_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for port administrative divisions. |
| 2 | department_department_name | Varchar (100) | Unique, Not Null | Formal name of the port division (e.g., Marine Operations, Customs & Revenue, Gate Security). |
| 3 | department_created_at | Timestamp | Default Current_Timestamp | Timestamp when the department was registered in the platform. |

---

### 5. tbl_shipping_company
**Primary key:** `shipping_company_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | shipping_company_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for registered commercial shipping line or agent entity. |
| 2 | shipping_company_name | Varchar (200) | Unique, Not Null | Registered corporate trade name of the carrier company. |
| 3 | shipping_company_license_number | Varchar (100) | Unique, Not Null | Statutory maritime commerce trade license or registration certificate number. |
| 4 | shipping_company_email | Varchar (255) | Unique, Not Null | Official corporate contact email address. |
| 5 | shipping_company_phone | Varchar (50) | Not Null | Corporate telephone number for operations and billing inquiries. |
| 6 | shipping_company_address | Text | Not Null | Corporate registered headquarters physical address. |
| 7 | shipping_company_jurisdiction | Varchar (100) | Not Null | Country or maritime territory of legal registry. |
| 8 | shipping_company_status | Varchar (30) | Not Null | Onboarding verification state (`PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`). |
| 9 | shipping_company_created_at | Timestamp | Default Current_Timestamp | Timestamp when carrier onboarding application was submitted. |

---

### 6. tbl_port
**Primary key:** `port_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | port_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for standardized international maritime seaports. |
| 2 | port_name | Varchar (200) | Not Null | Full official title of the commercial seaport (e.g., Port of Singapore, Port of Rotterdam). |
| 3 | port_code | Varchar (20) | Unique, Not Null | UN/LOCODE standard five-character international port location code (e.g., `SGSIN`, `NLRTM`). |
| 4 | port_country | Varchar (100) | Not Null | Sovereign country jurisdiction where the port facility operates. |
| 5 | port_city | Varchar (100) | Not Null | Municipality or metropolitan area where the harbor is situated. |
| 6 | port_timezone | Varchar (50) | Not Null | Standard IANA timezone identifier for berthing ETA conversions (e.g., `Asia/Singapore`). |
| 7 | port_is_active | Boolean | Not Null | Operational availability flag for marine route scheduling. |
| 8 | port_created_at | Timestamp | Default Current_Timestamp | Timestamp when the seaport was registered in master data. |

---

### 7. tbl_vessel
**Primary key:** `vessel_id`  
**Foreign key:** `vessel_shipping_company_id` references table `tbl_shipping_company`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | vessel_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for commercial merchant vessel records. |
| 2 | vessel_shipping_company_id | BigInt (20) | Foreign Key, Not Null | References `shipping_company_id` of `tbl_shipping_company` representing the carrier owner. |
| 3 | vessel_name | Varchar (200) | Not Null | Registered international maritime name of the ship. |
| 4 | vessel_imo_number | Varchar (50) | Unique, Not Null | International Maritime Organization (IMO) seven-digit statutory identifier. |
| 5 | vessel_type | Varchar (50) | Not Null | Classification type (e.g., Container Ship, Bulk Carrier, Ro-Ro, Tanker). |
| 6 | vessel_flag | Varchar (100) | Not Null | Sovereign country flag of vessel maritime registration. |
| 7 | vessel_call_sign | Varchar (50) | Null | Unique radio call sign assigned to the vessel for marine VHF communications. |
| 8 | vessel_length | Decimal (10,2) | Not Null | Overall length of the vessel measured in meters (LOA). |
| 9 | vessel_draft | Decimal (10,2) | Not Null | Maximum fully laden water draft depth requirement in meters. |
| 10 | vessel_capacity | Int (11) | Not Null | Maximum cargo capacity measured in Twenty-foot Equivalent Units (TEU) or deadweight tonnage. |
| 11 | vessel_status | Varchar (30) | Not Null | Vessel operational status (`SCHEDULED`, `ANCHORED`, `AT_BERTH`, `DEPARTED`). |
| 12 | vessel_created_at | Timestamp | Default Current_Timestamp | Timestamp when the vessel profile was added to the fleet registry. |
| 13 | vessel_updated_at | Timestamp | Default Current_Timestamp | Timestamp when vessel telemetry or status was last modified. |

---

### 8. tbl_berth
**Primary key:** `berth_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | berth_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for quayside berthing facility. |
| 2 | berth_name | Varchar (100) | Unique, Not Null | Official display name of the berth (e.g., Berth 01 - Deepwater Container Quay). |
| 3 | berth_code | Varchar (50) | Unique, Null | Standardized operational abbreviation code (e.g., `B01-DW`). |
| 4 | berth_type | Varchar (50) | Not Null | Operational accommodation category (`CONTAINER`, `BULK`, `GENERAL_CARGO`). |
| 5 | berth_max_length | Decimal (10,2) | Not Null | Maximum vessel length permissible at the quayside quay face in meters. |
| 6 | berth_max_draft | Decimal (10,2) | Not Null | Maintained water depth clearance alongside berth pocket in meters. |
| 7 | berth_status | Varchar (30) | Not Null | Real-time availability state (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, `RESERVED`). |
| 8 | berth_is_active | Boolean | Not Null | Flag indicating whether the berth is certified for active navigation. |
| 9 | berth_created_at | Timestamp | Default Current_Timestamp | Timestamp when the berth infrastructure record was added. |
| 10 | berth_updated_at | Timestamp | Default Current_Timestamp | Timestamp when berth occupancy or maintenance state was last updated. |

---

### 9. tbl_vessel_arrival_request
**Primary key:** `vessel_arrival_request_id`  
**Foreign key:** `vessel_arrival_request_vessel_id` references table `tbl_vessel`, `vessel_arrival_request_reviewed_by` references table `tbl_user`, `vessel_arrival_request_preferred_berth_id` references table `tbl_berth`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | vessel_arrival_request_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for pre-arrival electronic port entry applications. |
| 2 | vessel_arrival_request_vessel_id | BigInt (20) | Foreign Key, Not Null | References `vessel_id` of `tbl_vessel` applying for port entry. |
| 3 | vessel_arrival_request_requested_arrival_at | DateTime | Not Null | Estimated Time of Arrival (ETA) requested by shipping agent. |
| 4 | vessel_arrival_request_requested_departure_at | DateTime | Not Null | Estimated Time of Departure (ETD) requested by shipping agent. |
| 5 | vessel_arrival_request_cargo_type | Varchar (100) | Not Null | Description of primary inbound cargo category. |
| 6 | vessel_arrival_request_cargo_quantity | Decimal (12,2) | Not Null | Declared gross cargo volume in metric tonnes or TEU count. |
| 7 | vessel_arrival_request_status | Varchar (30) | Not Null | Adjudication status (`PENDING`, `APPROVED`, `REJECTED`, `ACTION_REQUIRED`). |
| 8 | vessel_arrival_request_submitted_at | DateTime | Not Null | Timestamp when the arrival request was electronically submitted. |
| 9 | vessel_arrival_request_reviewed_at | DateTime | Null | Timestamp when the Port Operations Officer evaluated the request. |
| 10 | vessel_arrival_request_reviewed_by | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` who approved or rejected the entry. |
| 11 | vessel_arrival_request_preferred_berth_id | BigInt (20) | Foreign Key, Null | References `berth_id` of `tbl_berth` requested by the agent. |
| 12 | vessel_arrival_request_remarks | Text | Null | Official operational notes, channel draft clearances, or rejection reasons. |

---

### 10. tbl_vessel_schedule
**Primary key:** `vessel_schedule_id`  
**Foreign key:** `vessel_schedule_arrival_request_id` references table `tbl_vessel_arrival_request`, `vessel_schedule_berth_id` references table `tbl_berth`, `vessel_schedule_created_by` references table `tbl_user`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | vessel_schedule_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for official marine berthing schedule entries. |
| 2 | vessel_schedule_arrival_request_id | BigInt (20) | Foreign Key, Unique, Not Null | References `vessel_arrival_request_id` of `tbl_vessel_arrival_request`. |
| 3 | vessel_schedule_berth_id | BigInt (20) | Foreign Key, Not Null | References `berth_id` of `tbl_berth` where the vessel is officially assigned. |
| 4 | vessel_schedule_scheduled_arrival_at | DateTime | Not Null | Confirmed operational arrival window (ETA). |
| 5 | vessel_schedule_scheduled_departure_at | DateTime | Not Null | Confirmed operational departure window (ETD). |
| 6 | vessel_schedule_actual_arrival_at | DateTime | Null | Recorded timestamp when vessel entered port outer anchorage. |
| 7 | vessel_schedule_actual_at_berth_at | DateTime | Null | Recorded timestamp when vessel was made fast alongside the berth face. |
| 8 | vessel_schedule_actual_departure_at | DateTime | Null | Recorded timestamp when vessel cast off lines and cleared the port channel. |
| 9 | vessel_schedule_status | Varchar (30) | Not Null | Active operational lifecycle (`SCHEDULED`, `ARRIVED`, `AT_BERTH`, `DEPARTED`, `DELAYED`). |
| 10 | vessel_schedule_operational_remarks | Text | Null | Real-time pilotage remarks, mooring line logs, or weather delays. |
| 11 | vessel_schedule_created_by | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` (Port Operations Officer) allocating the slot. |
| 12 | vessel_schedule_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when the schedule entry was established. |
| 13 | vessel_schedule_updated_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when the berthing status was last transitioned. |

---

### 11. tbl_cargo
**Primary key:** `cargo_id`  
**Foreign key:** `cargo_arrival_request_id` references table `tbl_vessel_arrival_request`, `cargo_origin_port_id` references table `tbl_port`, `cargo_destination_port_id` references table `tbl_port`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | cargo_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for manifested cargo consignment declarations. |
| 2 | cargo_arrival_request_id | BigInt (20) | Foreign Key, Not Null | References `vessel_arrival_request_id` of `tbl_vessel_arrival_request` carrying the shipment. |
| 3 | cargo_description | Varchar (255) | Not Null | Commercial trade description of the manifested freight consignment. |
| 4 | cargo_direction | Varchar (20) | Not Null | Movement direction classification (`IMPORT`, `EXPORT`, `TRANSSHIPMENT`). |
| 5 | cargo_type | Varchar (50) | Not Null | Physical packaging categorization (`CONTAINERIZED`, `BREAK_BULK`, `DRY_BULK`, `LIQUID`). |
| 6 | cargo_quantity | Decimal (12,2) | Not Null | Total number of freight packages or units in the consignment. |
| 7 | cargo_unit | Varchar (30) | Not Null | Standard measurement unit (e.g., `TEU`, `TONNES`, `PALLETS`). |
| 8 | cargo_weight | Decimal (12,2) | Not Null | Total verified gross mass (VGM) in metric tonnes. |
| 9 | cargo_origin_port_id | BigInt (20) | Foreign Key, Null | References `port_id` of `tbl_port` where the cargo was loaded. |
| 10 | cargo_destination_port_id | BigInt (20) | Foreign Key, Null | References `port_id` of `tbl_port` where final discharge is intended. |
| 11 | cargo_status | Varchar (30) | Not Null | Manifest status (`REGISTERED`, `UNDER_REVIEW`, `DISCHARGED`, `CLEARED`). |
| 12 | cargo_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when the cargo manifest was electronically uploaded. |
| 13 | cargo_updated_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when manifest data was last modified. |

---

### 12. tbl_container
**Primary key:** `container_id`  
**Foreign key:** `container_cargo_id` references table `tbl_cargo`, `container_delivered_by` references table `tbl_user`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | container_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for individual ISO freight container records. |
| 2 | container_cargo_id | BigInt (20) | Foreign Key, Not Null | References `cargo_id` of `tbl_cargo` linking container to parent bill of lading. |
| 3 | container_number | Varchar (20) | Unique, Not Null | Standardized BIC-coded ISO 6346 container identifier (e.g., `MSKU9082341`). |
| 4 | container_type | Varchar (50) | Not Null | ISO equipment size/type (`20ft Standard`, `40ft High Cube`, `Reefer`, `Open Top`). |
| 5 | container_gross_weight | Decimal (10,2) | Not Null | Verified gross weight of the laden container in metric tonnes. |
| 6 | container_status | Varchar (30) | Not Null | Physical quayside state (`REGISTERED`, `ARRIVED`, `UNLOADED`, `IN_YARD`, `LOADED_ON_TRUCK`, `DEPARTED`). |
| 7 | container_customs_status | Varchar (50) | Not Null | Statutory regulatory clearance state (`NOT_SUBMITTED`, `PENDING_REVIEW`, `UNDER_INSPECTION`, `CLEARED`, `CUSTOMS_HOLD`). |
| 8 | container_delivery_status | Varchar (50) | Not Null | Landside dispatch state (`PENDING_RELEASE`, `ASSIGNED_TO_TRUCK`, `OUT_FOR_DELIVERY`, `DELIVERED`). |
| 9 | container_delivery_destination | Varchar (255) | Not Null | Commercial consignee delivery city or inland container depot (ICD). |
| 10 | container_delivery_location | Varchar (200) | Not Null | Final physical warehouse address for container unstuffing. |
| 11 | container_delivery_recipient | Varchar (150) | Not Null | Legal recipient name or authorized corporate receiving agent. |
| 12 | container_expected_delivery_date | DateTime | Null | Scheduled delivery deadline agreed in bill of lading. |
| 13 | container_delivered_at | DateTime | Null | Exact timestamp recorded upon physical gate-out release. |
| 14 | container_delivered_by | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` (Gate Officer) releasing the barrier. |
| 15 | container_delivery_remarks | Text | Null | Gate release notes, seal verification remarks, or damage logs. |
| 16 | container_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when container manifest record was established. |
| 17 | container_updated_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when physical or statutory state was last transitioned. |

---

### 13. tbl_container_tracking_event
**Primary key:** `tracking_event_id`  
**Foreign key:** `tracking_event_container_id` references table `tbl_container`, `tracking_event_gate_pass_id` references table `tbl_gate_pass`, `tracking_event_updated_by` references table `tbl_user`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | tracking_event_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for immutable container movement audit events. |
| 2 | tracking_event_container_id | BigInt (20) | Foreign Key, Not Null | References `container_id` of `tbl_container` undergoing movement. |
| 3 | tracking_event_gate_pass_id | BigInt (20) | Foreign Key, Null | References `gate_pass_id` of `tbl_gate_pass` associated with landside exit. |
| 4 | tracking_event_status | Varchar (50) | Not Null | Operational milestone achieved (`UNLOADED_FROM_VESSEL`, `STACKED_IN_YARD`, `CUSTOMS_CLEARED`, `GATE_OUT`). |
| 5 | tracking_event_timestamp | DateTime | Not Null | Exact GPS or clock timestamp when the physical action occurred. |
| 6 | tracking_event_location | Varchar (200) | Not Null | Physical quayside, yard slot, scanner tunnel, or terminal gate location. |
| 7 | tracking_event_description | Text | Null | Operational narrative describing the crane move, vehicle transfer, or ruling. |
| 8 | tracking_event_exception_reason | Varchar (100) | Null | Exception alert category (e.g., `CUSTOMS_HOLD_FLAG`, `SEAL_TAMPERED`). |
| 9 | tracking_event_updated_by | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` who logged or supervised the event. |
| 10 | tracking_event_created_at | DateTime | Not Null, Default Current_Timestamp | System record creation timestamp. |

---

### 14. tbl_customs_inspection
**Primary key:** `customs_inspection_id`  
**Foreign key:** `customs_inspection_container_id` references table `tbl_container`, `customs_inspection_officer_id` references table `tbl_user`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | customs_inspection_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for statutory cargo inspection workflows. |
| 2 | customs_inspection_container_id | BigInt (20) | Foreign Key, Not Null | References `container_id` of `tbl_container` selected for physical or non-intrusive examination. |
| 3 | customs_inspection_officer_id | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` (Customs Officer) conducting the examination. |
| 4 | customs_inspection_status | Varchar (50) | Not Null | Inspection lifecycle (`PENDING_EXAMINATION`, `UNDER_INSPECTION`, `COMPLETED`, `HOLD_APPLIED`). |
| 5 | customs_inspection_result | Varchar (50) | Null | Formal inspection finding (`PASSED`, `FAILED`, `DISCREPANCY_NOTED`, `CONTRABAND_SUSPECTED`). |
| 6 | customs_inspection_document_status | Varchar (50) | Not Null | Regulatory documentary verification state (`VERIFIED`, `AMENDMENT_REQUESTED`). |
| 7 | customs_inspection_remarks | Text | Null | Officer's physical inspection observations, seal integrity notes, or unstuffing findings. |
| 8 | customs_inspection_hold_reason | Varchar (100) | Null | Formal legal justification cited when a statutory detention or hold is placed. |
| 9 | customs_inspection_started_at | DateTime | Not Null | Timestamp when container was positioned at inspection bay or scanner tunnel. |
| 10 | customs_inspection_completed_at | DateTime | Null | Timestamp when inspection examination was formally concluded. |
| 11 | customs_inspection_clearance_date | DateTime | Null | Official date and time when customs release stamp was recorded. |
| 12 | customs_inspection_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when inspection record was initiated. |
| 13 | customs_inspection_updated_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when inspection finding was last recorded. |

---

### 15. tbl_customs_document
**Primary key:** `document_id`  
**Foreign key:** `document_container_id` references table `tbl_container`, `document_uploaded_by` references table `tbl_user`, `document_reviewed_by` references table `tbl_user`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | document_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for statutory regulatory and customs compliance filings. |
| 2 | document_container_id | BigInt (20) | Foreign Key, Not Null | References `container_id` of `tbl_container` requiring clearance. |
| 3 | document_type | Varchar (50) | Not Null | Statutory document type (`COMMERCIAL_INVOICE`, `PACKING_LIST`, `BILL_OF_LADING`, `PHYTOSANITARY_CERT`). |
| 4 | workflow_type | Varchar (30) | Not Null | Filing lifecycle type (`NORMAL_REVIEW`, `PRE_ARRIVAL_DECLARATION`). |
| 5 | document_file | Varchar (255) | Not Null | Cloud file storage path or Supabase object URI for uploaded evidence. |
| 6 | document_name | Varchar (255) | Not Null | Original file name of the document uploaded by the shipping agent. |
| 7 | file_size | BigInt (20) | Not Null | Size of uploaded file in bytes. |
| 8 | file_type | Varchar (100) | Not Null | MIME format type of the document (e.g., `application/pdf`, `image/jpeg`). |
| 9 | document_version | Int (11) | Not Null | Document version number incremented upon amendment resubmission. |
| 10 | document_is_active | Boolean | Not Null | Flag indicating if this document version represents the active regulatory filing. |
| 11 | document_review_status | Varchar (30) | Not Null | Adjudication status (`PENDING_REVIEW`, `APPROVED`, `REJECTED`, `INSPECTION_REQUIRED`). |
| 12 | document_review_remarks | Text | Not Null | Customs Authority Officer's official inspection findings and ruling notes. |
| 13 | document_uploaded_by | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` representing the applicant shipping agent. |
| 14 | document_uploaded_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when document was uploaded to the platform. |
| 15 | document_reviewed_by | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` (Customs Officer) issuing the clearance ruling. |
| 16 | document_reviewed_at | DateTime | Null | Timestamp when the Customs Officer recorded the clearance decision. |

---

### 16. tbl_yard
**Primary key:** `yard_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | yard_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for terminal storage yard zones. |
| 2 | yard_name | Varchar (100) | Not Null | Full display title of the storage yard (e.g., Container Yard A - Import Stacking). |
| 3 | yard_code | Varchar (50) | Unique, Not Null | Standardized operational identifier (e.g., `CY-A`). |
| 4 | yard_type | Varchar (50) | Not Null | Storage purpose (`IMPORT_LADEN`, `EXPORT_LADEN`, `REEFER_PARK`, `EMPTY_DEPOT`). |
| 5 | yard_status | Varchar (20) | Not Null | Operational condition (`ACTIVE`, `MAINTENANCE`, `FULL`). |
| 6 | yard_capacity | Int (11) | Not Null | Total theoretical container ground-slot storage capacity in TEU. |
| 7 | yard_occupied | Int (11) | Not Null | Real-time count of currently stacked containers within the yard. |
| 8 | yard_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when the terminal yard sector was established. |
| 9 | yard_updated_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when yard inventory and slot count was last modified. |

---

### 17. tbl_yard_slot
**Primary key:** `yard_slot_id`  
**Foreign key:** `yard_slot_block_id` references table `tbl_yard_block`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | yard_slot_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for exact physical 3D container stacking slot cells. |
| 2 | yard_slot_block_id | BigInt (20) | Foreign Key, Not Null | References `yard_block_id` of `tbl_yard_block` housing the slot. |
| 3 | yard_slot_code | Varchar (50) | Not Null | Standardized slot identifier coordinate (e.g., `B04-R02-T03`). |
| 4 | yard_slot_bay | Int (11) | Not Null | Longitudinal bay coordinate number (parallel to container length). |
| 5 | yard_slot_row | Int (11) | Not Null | Lateral row position number across the yard block width. |
| 6 | yard_slot_tier | Int (11) | Not Null | Vertical stacking elevation tier height level (1 = ground, 2-5 = stacked above). |
| 7 | yard_slot_status | Varchar (20) | Not Null | Occupancy availability state (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `BLOCKED`). |
| 8 | yard_slot_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when slot coordinate was mapped into Yard Master. |
| 9 | yard_slot_updated_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when slot occupancy status was last transitioned. |

---

### 18. tbl_yard_allocation
**Primary key:** `yard_allocation_id`  
**Foreign key:** `yard_allocation_container_id` references table `tbl_container`, `yard_allocation_slot_id` references table `tbl_yard_slot`, `yard_allocation_allocated_by_id` references table `tbl_user`, `yard_allocation_released_by_id` references table `tbl_user`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | yard_allocation_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for container yard slotting assignment records. |
| 2 | yard_allocation_container_id | BigInt (20) | Foreign Key, Not Null | References `container_id` of `tbl_container` stacked in the yard slot. |
| 3 | yard_allocation_slot_id | BigInt (20) | Foreign Key, Not Null | References `yard_slot_id` of `tbl_yard_slot` where the container is positioned. |
| 4 | yard_allocation_status | Varchar (20) | Not Null | Slot allocation state (`ACTIVE`, `RELEASED`, `RELOCATED`). |
| 5 | yard_allocation_allocated_at | DateTime | Not Null | Timestamp when RTG or reach stacker completed container grounding. |
| 6 | yard_allocation_allocated_by_id | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` (Terminal Operator) assigning the location. |
| 7 | yard_allocation_released_at | DateTime | Null | Timestamp when container was picked from stack for truck dispatch. |
| 8 | yard_allocation_released_by_id | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` authorising quayside or yard unstacking. |
| 9 | yard_allocation_remarks | Text | Not Null | Special handling remarks (e.g., HazMat isolation, reefer power plug-in confirmed). |
| 10 | yard_allocation_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when allocation record was created. |
| 11 | yard_allocation_updated_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when allocation was last updated. |

---

### 19. tbl_truck
**Primary key:** `truck_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | truck_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for commercial container transport vehicles. |
| 2 | truck_number | Varchar (50) | Unique, Not Null | Statutory vehicle registration plate number (e.g., `KL-07-AB-1234`). |
| 3 | truck_company_name | Varchar (150) | Null | Registered logistics or third-party trucking enterprise owning the vehicle. |
| 4 | truck_status | Varchar (30) | Not Null | Vehicle access authorization state (`AUTHORIZED`, `WAITING_AT_GATE`, `IN_TERMINAL`, `BLOCKED`). |
| 5 | truck_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when the transport truck was onboarded for port access. |
| 6 | truck_updated_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when truck status was last updated. |

---

### 20. tbl_driver
**Primary key:** `driver_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | driver_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for authorized transport truck drivers. |
| 2 | driver_name | Varchar (150) | Not Null | Driver's full legal name. |
| 3 | driver_license_number | Varchar (100) | Unique, Not Null | Heavy Commercial Vehicle (HCV) commercial driving license number. |
| 4 | driver_phone | Varchar (50) | Not Null | Driver's active mobile phone number for SMS gate appointment alerts. |
| 5 | driver_email | Varchar (255) | Not Null | Driver or dispatcher email address where digital QR gate pass is delivered. |
| 6 | driver_status | Varchar (30) | Not Null | Statutory driver access authorization (`ACTIVE`, `SUSPENDED`, `BLACKLISTED`). |
| 7 | driver_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when driver profile was registered. |
| 8 | driver_updated_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when driver profile was last updated. |

---

### 21. tbl_gate
**Primary key:** `gate_id`  
**Foreign key:** Nil  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | gate_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for physical port perimeter security gates. |
| 2 | gate_name | Varchar (150) | Unique, Not Null | Display name of the gate facility (e.g., North Inbound Terminal Gate 01). |
| 3 | gate_code | Varchar (50) | Unique, Not Null | Operational gate code (e.g., `GT-IN-01`, `GT-OUT-02`). |
| 4 | gate_type | Varchar (50) | Not Null | Access direction category (`INBOUND_GATE`, `OUTBOUND_GATE`, `RAIL_PORTAL`). |
| 5 | gate_is_active | Boolean | Not Null | Flag indicating whether optical OCR scanner and boom barrier are active. |
| 6 | gate_created_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when the gate facility was added to terminal infrastructure. |

---

### 22. tbl_gate_pass
**Primary key:** `gate_pass_id`  
**Foreign key:** `gate_pass_truck_id` references table `tbl_truck`, `gate_pass_driver_id` references table `tbl_driver`, `gate_pass_issued_by` references table `tbl_user`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | gate_pass_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for cryptographic container movement authorizations. |
| 2 | gate_pass_pass_number | Varchar (50) | Unique, Not Null | Human-readable gate permit reference number (e.g., `GP-2026-4412`). |
| 3 | gate_pass_movement_number | Varchar (50) | Unique, Not Null | Internal operational movement tracking token. |
| 4 | gate_pass_truck_id | BigInt (20) | Foreign Key, Not Null | References `truck_id` of `tbl_truck` authorized for container pickup or delivery. |
| 5 | gate_pass_driver_id | BigInt (20) | Foreign Key, Not Null | References `driver_id` of `tbl_driver` holding verified statutory commercial driving credentials. |
| 6 | gate_pass_issued_by | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` (Gate Officer or Logistics Coordinator) issuing the pass. |
| 7 | gate_pass_status | Varchar (30) | Not Null | Movement permission status (`ISSUED`, `VERIFIED`, `COMPLETED`, `CANCELLED`, `EXPIRED`). |
| 8 | gate_pass_type | Varchar (30) | Not Null | Directional gate operation category (`IMPORT_PICKUP`, `EXPORT_DROPOFF`, `EMPTY_RETURN`). |
| 9 | gate_pass_verification_code | Varchar (100) | Unique, Not Null | Cryptographic security hash used for optical and manual verification at gate barriers. |
| 10 | gate_pass_qr_code | Text | Not Null | Encoded Base64 QR code matrix scanned at physical gate boom barriers. |
| 11 | gate_pass_issued_at | DateTime | Not Null, Default Current_Timestamp | Timestamp when the digital gate pass was formally generated. |
| 12 | gate_pass_valid_until | DateTime | Not Null | Time-bounded appointment expiration timestamp after which the pass becomes invalid. |
| 13 | gate_pass_verified_at | DateTime | Null | Timestamp recorded when optical scanner validated the driver QR code at inbound gate. |
| 14 | gate_pass_used_at | DateTime | Null | Timestamp recorded when container physically departed through the outbound boom barrier. |
| 15 | gate_pass_created_at | DateTime | Not Null, Default Current_Timestamp | System record creation timestamp. |

---

### 23. tbl_gate_release
**Primary key:** `gate_release_id`  
**Foreign key:** `gate_release_container_id` references table `tbl_container`, `gate_release_gate_pass_id` references table `tbl_gate_pass`, `gate_release_officer_id` references table `tbl_user`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | gate_release_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for physical boom barrier release transaction logs. |
| 2 | gate_release_container_id | BigInt (20) | Foreign Key, Not Null | References `container_id` of `tbl_container` physically leaving the port premises. |
| 3 | gate_release_gate_pass_id | BigInt (20) | Foreign Key, Null | References `gate_pass_id` of `tbl_gate_pass` verified during the release. |
| 4 | gate_release_officer_id | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` (Gate Security Officer) commanding the barrier lift. |
| 5 | gate_release_previous_status | Varchar (50) | Not Null | Container physical state before gate departure (`LOADED_ON_TRUCK`). |
| 6 | gate_release_new_status | Varchar (50) | Not Null | Updated container physical state recorded after passing gate (`DEPARTED`). |
| 7 | gate_release_truck_number | Varchar (50) | Not Null | License plate number verified through optical character recognition (OCR). |
| 8 | gate_release_driver_name | Varchar (150) | Not Null | Verified full name of driver operating the transport vehicle. |
| 9 | gate_release_driver_license | Varchar (100) | Not Null | Verified driver license number matched against gate pass records. |
| 10 | gate_release_exit_point | Varchar (100) | Not Null | Outbound terminal gate lane where release occurred (e.g., Gate 2 Outbound Lane A). |
| 11 | gate_release_remarks | Text | Null | Gate officer inspection remarks, container seal serial verification, or notes. |
| 12 | gate_release_time | DateTime | Not Null | Exact timestamp when physical boom barrier opened for vehicle egress. |
| 13 | gate_release_created_at | DateTime | Not Null, Default Current_Timestamp | System audit creation timestamp. |

---

### 24. tbl_audit_log
**Primary key:** `audit_log_id`  
**Foreign key:** `audit_log_user_id` references table `tbl_user`  

| No: | Field name | Datatype (Size) | Key Constraints | Description of the field |
| :--- | :--- | :--- | :--- | :--- |
| 1 | audit_log_id | BigInt (20) | Primary Key, Auto_increment | Unique identifier for immutable platform compliance and security audit logs. |
| 2 | audit_log_timestamp | DateTime | Not Null, Default Current_Timestamp | Exact UTC clock timestamp when the system transaction was executed. |
| 3 | audit_log_user_id | BigInt (20) | Foreign Key, Null | References `user_id` of `tbl_user` who performed the action. |
| 4 | audit_log_actor_name | Varchar (150) | Null | Recorded full name or system process identifier of the actor. |
| 5 | audit_log_role | Varchar (100) | Not Null | Security role assumed by the actor during execution (e.g., `port_administrator`). |
| 6 | audit_log_action | Varchar (100) | Not Null | Action performed (`LOGIN_SUCCESS`, `BERTH_ALLOCATED`, `CUSTOMS_CLEARED`, `GATE_PASS_ISSUED`). |
| 7 | audit_log_category | Varchar (100) | Not Null | Audit module classification (`AUTHENTICATION`, `VESSEL_OPERATIONS`, `CUSTOMS`, `GATE`). |
| 8 | audit_log_target_type | Varchar (100) | Not Null | Entity type affected by the transaction (`Container`, `VesselArrivalRequest`, `GatePass`). |
| 9 | audit_log_target_id | Varchar (100) | Null | Primary key or reference token of the affected entity. |
| 10 | audit_log_description | Text | Not Null | Detailed chronological narrative of payload data or status transitions. |
| 11 | audit_log_status | Varchar (30) | Not Null | Transaction execution outcome (`SUCCESS`, `FAILED`, `UNAUTHORIZED`). |
| 12 | audit_log_ip_address | Varchar (50) | Null | Originating IPv4 or IPv6 client network address for forensic accountability. |
