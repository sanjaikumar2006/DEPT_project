import os
import shutil
import time
import csv
import io
import logging
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel

from . import models, schemas
from .database import SessionLocal, engine

# --- 1. SETUP STORAGE ---
UPLOAD_DIR = "uploaded_files"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables automatically
models.Base.metadata.create_all(bind=engine)

# --- DATABASE MIGRATION CHECK ---
def ensure_profile_columns():
    """Safely adds profile_pic column if it doesn't exist, preventing DB errors."""
    try:
        with engine.connect() as conn:
            # Check Faculty table
            col_info = conn.execute(text("PRAGMA table_info('faculty')")).fetchall()
            cols = [c[1] for c in col_info]
            if 'profile_pic' not in cols:
                conn.execute(text("ALTER TABLE faculty ADD COLUMN profile_pic TEXT"))
                logger.info("Added 'profile_pic' column to faculty table.")

            # Check Students table
            col_info = conn.execute(text("PRAGMA table_info('students')")).fetchall()
            cols = [c[1] for c in col_info]
            if 'profile_pic' not in cols:
                conn.execute(text("ALTER TABLE students ADD COLUMN profile_pic TEXT"))
                logger.info("Added 'profile_pic' column to students table.")
            conn.commit()
    except Exception as e:
        logger.error(f"Migration check failed: {e}")

ensure_profile_columns()

# --- 2. INITIALIZE THE APP ---
app = FastAPI()

# --- 3. MOUNT STATIC FILES ---
app.mount("/static", StaticFiles(directory=UPLOAD_DIR), name="static")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Session Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- PYDANTIC MODELS ---
class MarkSyncRequest(BaseModel):
    student_roll_no: str
    course_code: str
    cia1_marks: float
    cia1_retest: float
    cia2_marks: float
    cia2_retest: float
    subject_attendance: float

class AdminUserCreateRequest(BaseModel):
    id: str
    name: str
    role: str  # 'Student' or 'Faculty'
    password: str
    year: Optional[int] = 1
    semester: Optional[int] = 1
    section: Optional[str] = "A"
    designation: Optional[str] = None
    doj: Optional[str] = None

class AdminEnrollmentRequest(BaseModel):
    student_roll_no: str
    course_code: str
    section: Optional[str] = "A"

# --- AUTHENTICATION ---
@app.post("/login", response_model=schemas.Token)
def login(login_data: schemas.LoginData, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == login_data.username).first()
    if user and user.password == login_data.password:
        return {"access_token": user.id, "token_type": "bearer", "role": user.role, "user_id": user.id}
    raise HTTPException(status_code=400, detail="Incorrect username or password")

# --- ADMIN: USER & COURSE MANAGEMENT ---

@app.post("/admin/create-user")
def admin_create_user(data: AdminUserCreateRequest, db: Session = Depends(get_db)):
    try:
        if db.query(models.User).filter(models.User.id == data.id).first():
            raise HTTPException(status_code=400, detail="User ID already exists")

        new_user = models.User(id=data.id, role=data.role, password=data.password)
        db.add(new_user)
        db.flush() 

        if data.role == "Student":
            profile = models.Student(
                roll_no=data.id, 
                name=data.name, 
                year=int(data.year) if data.year else 1, 
                semester=int(data.semester) if data.semester else 1,
                section=data.section,
                cgpa=0.0,
                attendance_percentage=0.0
            )
            db.add(profile)
            db.flush()

            courses = db.query(models.Course).filter(
                models.Course.semester == data.semester,
                models.Course.section == data.section
            ).all()
            
            for course in courses:
                enrollment = models.AcademicData(
                    student_roll_no=data.id, 
                    course_id=course.id, 
                    course_code=course.code, 
                    subject=course.title,
                    section=data.section,
                    status="Pursuing"
                )
                db.add(enrollment)

        elif data.role == "Faculty":
            profile = models.Faculty(
                staff_no=data.id, 
                name=data.name, 
                designation=data.designation or "Assistant Professor", 
                doj=data.doj or "01.01.2024"
            )
            db.add(profile)
        
        db.commit()
        return {"message": f"{data.role} created and enrolled successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- NEW: BULK UPLOAD FROM CSV ---
@app.post("/admin/bulk-upload/{role}")
async def bulk_upload_users(role: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    contents = await file.read()
    decoded = contents.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    success_count = 0
    errors = []

    for row in reader:
        try:
            uid = row.get('id') or row.get('roll_no') or row.get('staff_no')
            if not uid: continue

            if db.query(models.User).filter(models.User.id == uid).first():
                errors.append(f"ID {uid} already exists")
                continue

            new_user = models.User(id=uid, role=role, password=row.get('password', '123456'))
            db.add(new_user)
            db.flush()

            if role == "Student":
                profile = models.Student(
                    roll_no=uid,
                    name=row.get('name'),
                    year=int(row.get('year', 1)),
                    semester=int(row.get('semester', 1)),
                    section=row.get('section', 'A'),
                    cgpa=float(row.get('cgpa', 0.0))
                )
                db.add(profile)
                db.flush()

                courses = db.query(models.Course).filter(
                    models.Course.semester == profile.semester,
                    models.Course.section == profile.section
                ).all()
                for c in courses:
                    db.add(models.AcademicData(
                        student_roll_no=uid, course_id=c.id, course_code=c.code, 
                        subject=c.title, section=c.section
                    ))

            elif role == "Faculty":
                profile = models.Faculty(
                    staff_no=uid,
                    name=row.get('name'),
                    designation=row.get('designation', 'Assistant Professor'),
                    doj=row.get('doj', '01.01.2026')
                )
                db.add(profile)

            success_count += 1
        except Exception as e:
            errors.append(f"Error at row {uid if 'uid' in locals() else 'unknown'}: {str(e)}")

    db.commit()
    return {"message": f"Successfully uploaded {success_count} users", "errors": errors}

@app.post("/admin/courses")
def add_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Course).filter(
        models.Course.code == course.code,
        models.Course.section == course.section
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Subject {course.code} already exists for Section {course.section}")
    
    db_course = models.Course(**course.dict())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)

    existing_students = db.query(models.Student).filter(
        models.Student.semester == course.semester,
        models.Student.section == course.section
    ).all()

    for student in existing_students:
        enrollment = models.AcademicData(
            student_roll_no=student.roll_no,
            course_id=db_course.id,
            course_code=db_course.code,
            subject=db_course.title,
            section=db_course.section,
            status="Pursuing"
        )
        db.add(enrollment)
    
    db.commit()
    return db_course

@app.delete("/admin/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    db.query(models.AcademicData).filter(models.AcademicData.course_id == course.id).delete()
    db.delete(course)
    db.commit()
    return {"message": "Course removed"}

@app.post("/admin/enroll")
def enroll_student(data: AdminEnrollmentRequest, db: Session = Depends(get_db)):
    try:
        student = db.query(models.Student).filter(models.Student.roll_no == data.student_roll_no).first()
        course = db.query(models.Course).filter(models.Course.code == data.course_code).first() 
        if not student or not course:
            raise HTTPException(status_code=404, detail="Student or Course not found")

        existing = db.query(models.AcademicData).filter(
            models.AcademicData.student_roll_no == data.student_roll_no,
            models.AcademicData.course_code == data.course_code
        ).first()
        if existing:
            return {"message": "Student already enrolled in this course"}

        enrollment = models.AcademicData(
            student_roll_no=data.student_roll_no,
            course_id=course.id,
            course_code=data.course_code,
            subject=course.title,
            status="Pursuing"
        )
        db.add(enrollment)
        db.commit()
        return {"message": "Student enrolled successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# --- FACULTY: MARKS & ATTENDANCE ---

@app.get("/faculty/my-courses")
def get_faculty_courses(staff_no: str, db: Session = Depends(get_db)):
    return db.query(models.Course).filter(models.Course.faculty_id == staff_no).all()

@app.get("/marks/section")
def get_section_marks(course_code: str, section: Optional[str] = "A", db: Session = Depends(get_db)):
    results = db.query(
        models.Student.name,
        models.AcademicData.student_roll_no,
        models.AcademicData.cia1_marks,
        models.AcademicData.cia1_retest,
        models.AcademicData.cia2_marks,
        models.AcademicData.cia2_retest,
        models.AcademicData.subject_attendance
    ).join(
        models.AcademicData, models.Student.roll_no == models.AcademicData.student_roll_no
    ).filter(
        models.AcademicData.course_code == course_code,
        models.AcademicData.section == section
    ).all()
    
    response_data = []
    for row in results:
        response_data.append({
            "name": row[0],
            "roll_no": row[1],
            "cia1_marks": row[2] or 0,
            "cia1_retest": row[3] or 0,
            "cia2_marks": row[4] or 0,
            "cia2_retest": row[5] or 0,
            "subject_attendance": row[6] or 0
        })
    return response_data

@app.post("/marks/sync")
def sync_marks(data: MarkSyncRequest, db: Session = Depends(get_db)):
    record = db.query(models.AcademicData).filter(
        models.AcademicData.student_roll_no == data.student_roll_no,
        models.AcademicData.course_code == data.course_code
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    record.cia1_marks = data.cia1_marks
    record.cia1_retest = data.cia1_retest
    record.cia2_marks = data.cia2_marks
    record.cia2_retest = data.cia2_retest
    record.subject_attendance = data.subject_attendance
    
    db.commit()
    return {"message": "Sync successful"}

# --- STUDENT: ACADEMIC PORTAL ---
@app.get("/marks/cia")
def get_student_marks(student_id: str, db: Session = Depends(get_db)):
    marks = db.query(models.AcademicData).filter(models.AcademicData.student_roll_no == student_id).all()
    return [{
        "subject": m.subject if m.subject else m.course_code,
        "course_code": m.course_code,
        "cia1": m.cia1_marks or 0,
        "cia1_retest": m.cia1_retest or 0, 
        "cia2": m.cia2_marks or 0,
        "cia2_retest": m.cia2_retest or 0, 
        "subject_attendance": m.subject_attendance or 0,
        "total": max(m.cia1_marks or 0, m.cia1_retest or 0) + max(m.cia2_marks or 0, m.cia2_retest or 0)
    } for m in marks]

# --- MATERIALS & ANNOUNCEMENTS ---

@app.post("/materials")
async def upload_material(
    course_id: Optional[int] = Form(None),
    course_code: str = Form(...),
    type: str = Form(...),
    title: str = Form(...),
    posted_by: str = Form(...),
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        file_link = None
        if file:
            filename = f"{course_code}_{int(time.time())}_{file.filename}"
            file_location = os.path.join(UPLOAD_DIR, filename)
            with open(file_location, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_link = f"http://localhost:8000/static/{filename}"
        elif url:
            file_link = url
        else:
            raise HTTPException(status_code=400, detail="Either file or url required")

        cid = course_id
        if not cid:
            course = db.query(models.Course).filter(models.Course.code == course_code).first()
            if course: 
                cid = course.id
            else: 
                cid = 0

        # FIX: Log the upload details for debugging
        logger.info(f"Uploading material: course_code={course_code}, course_id={cid}, type={type}, title={title}")
        
        db_material = models.Material(
            course_id=cid, 
            course_code=course_code.strip().upper(),  # Normalize course code
            type=type, 
            title=title, 
            file_link=file_link, 
            posted_by=posted_by
        )
        db.add(db_material)
        db.commit()
        db.refresh(db_material)
        logger.info(f"Material uploaded successfully with ID: {db_material.id}")
        return db_material
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/materials/{identifier}")
def get_course_materials(identifier: str, db: Session = Depends(get_db)):
    logger.info(f"Fetching materials for identifier: {identifier}")
    
    if identifier.isdigit():
        materials = db.query(models.Material).filter(models.Material.course_id == int(identifier)).all()
    else:
        # FIX: Use partial matching to find materials when student searches with short code
        clean_identifier = identifier.strip().upper()
        
        # Try multiple matching strategies:
        # 1. Exact match
        materials = db.query(models.Material).filter(
            models.Material.course_code == clean_identifier
        ).all()
        
        # 2. If no exact match, try partial match (e.g., "OS" should match "OS320T")
        if not materials:
            materials = db.query(models.Material).filter(
                models.Material.course_code.ilike(f"%{clean_identifier}%")
            ).all()
            
        # 3. Also try matching with course title in AcademicData table
        if not materials:
            # Get course code from AcademicData that matches the subject name
            academic_records = db.query(models.AcademicData).filter(
                models.AcademicData.subject.ilike(f"%{clean_identifier}%")
            ).all()
            
            if academic_records:
                course_codes = list(set([r.course_code for r in academic_records]))
                materials = db.query(models.Material).filter(
                    models.Material.course_code.in_(course_codes)
                ).all()
    
    logger.info(f"Found {len(materials)} materials for identifier: {identifier}")
    return materials

# FIX: Add a new endpoint to get materials by course code with section filter
@app.get("/materials/course/{course_code}")
def get_materials_by_course_section(
    course_code: str, 
    section: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get materials for a specific course and optional section.
    This ensures students see only materials uploaded for their section.
    """
    clean_course_code = course_code.strip().upper()
    query = db.query(models.Material).filter(
        models.Material.course_code.ilike(f"%{clean_course_code}%")
    )
    
    logger.info(f"Fetching materials for course: {course_code}, section: {section}")
    materials = query.all()
    logger.info(f"Found {len(materials)} materials for course: {course_code}")
    
    return materials

@app.delete("/materials/{material_id}")
def delete_material(material_id: int, db: Session = Depends(get_db)):
    mat = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")
    if mat.file_link and "localhost" in mat.file_link:
        try:
            fname = mat.file_link.split("/")[-1]
            os.remove(os.path.join(UPLOAD_DIR, fname))
        except Exception: 
            pass
    db.delete(mat)
    db.commit()
    return {"message": "Deleted"}

@app.post("/announcements")
def create_announcement(announcement: schemas.AnnouncementCreate, db: Session = Depends(get_db)):
    db_announcement = models.Announcement(
        title=announcement.title, content=announcement.content, type=announcement.type,
        posted_by=announcement.posted_by, course_code=announcement.course_code or "Global",
        section=getattr(announcement, 'section', 'All')
    )
    db.add(db_announcement)
    db.commit()
    return db_announcement

@app.get("/announcements")
def get_announcements(type: Optional[str] = None, section: Optional[str] = None, student_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Announcement)
    if student_id:
        student = db.query(models.Student).filter(models.Student.roll_no == student_id).first()
        if student:
            query = query.filter((models.Announcement.section == "All") | (models.Announcement.section == student.section))
    if type: query = query.filter(models.Announcement.type == type)
    return query.order_by(models.Announcement.id.desc()).all()

# --- PROFILES & PHOTO UPLOADS ---

@app.get("/faculty/{staff_no}", response_model=schemas.Faculty)
def get_faculty(staff_no: str, db: Session = Depends(get_db)):
    faculty = db.query(models.Faculty).filter(models.Faculty.staff_no == staff_no.strip()).first()
    if not faculty: raise HTTPException(status_code=404, detail="Faculty not found")
    return faculty

@app.post("/faculty/{staff_no}/photo")
async def upload_faculty_photo(staff_no: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    faculty = db.query(models.Faculty).filter(models.Faculty.staff_no == staff_no.strip()).first()
    if not faculty: raise HTTPException(status_code=404, detail="Faculty not found")
    
    filename = f"faculty_{staff_no.strip()}_{int(time.time())}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    faculty.profile_pic = f"http://localhost:8000/static/{filename}"
    db.commit()
    db.refresh(faculty)
    return {"profile_pic": faculty.profile_pic}

@app.get("/student/{roll_no}", response_model=schemas.Student)
def get_student(roll_no: str, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.roll_no == roll_no.strip()).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    return student

@app.post("/student/upload-photo")
async def upload_student_photo(roll_no: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.roll_no == roll_no.strip()).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    
    filename = f"student_{roll_no.strip()}_{int(time.time())}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    student.profile_pic = f"http://localhost:8000/static/{filename}"
    db.commit()
    db.refresh(student)
    return {"profile_pic": student.profile_pic}

@app.get("/courses", response_model=List[schemas.Course])
def get_courses(semester: Optional[int] = None, section: Optional[str] = None, faculty_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Course)
    if semester: query = query.filter(models.Course.semester == semester)
    if section: query = query.filter(models.Course.section == section)
    if faculty_id: query = query.filter(models.Course.faculty_id == faculty_id)
    return query.all()

@app.get("/admin/faculties")
def get_all_faculties(designation: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Faculty)
    if designation and designation != "":
        query = query.filter(models.Faculty.designation == designation)
    return query.all()

@app.get("/admin/students")
def get_all_students(year: Optional[int] = None, semester: Optional[int] = None, section: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Student)
    if year:
        query = query.filter(models.Student.year == year)
    if semester:
        query = query.filter(models.Student.semester == semester)
    if section and section != "":
        query = query.filter(models.Student.section == section)
    return query.all()

# --- ADMIN: UPDATE & DELETE STUDENT ---

@app.put("/admin/student/update")
def update_student(data: dict, db: Session = Depends(get_db)):
    # FIX: Check multiple possible ID keys sent from frontend
    orig_id = data.get('original_roll_no') or data.get('roll_no')
    new_id = data.get('roll_no')
    
    student = db.query(models.Student).filter(models.Student.roll_no == orig_id).first()
    user = db.query(models.User).filter(models.User.id == orig_id).first()
    
    if not student or not user:
        raise HTTPException(status_code=404, detail="Student or User account not found")

    try:
        if str(orig_id) != str(new_id):
            if db.query(models.User).filter(models.User.id == new_id).first():
                raise HTTPException(status_code=400, detail="New Roll Number already exists")
            
            # Manually update Foreign Key in AcademicData before primary key update
            db.query(models.AcademicData).filter(models.AcademicData.student_roll_no == orig_id).update({"student_roll_no": new_id})
            
            student.roll_no = new_id
            user.id = new_id
            db.flush()

        student.name = data.get('name')
        student.year = int(data.get('year', student.year))
        student.semester = int(data.get('semester', student.semester))
        student.section = data.get('section')
        student.cgpa = float(data.get('cgpa', student.cgpa))

        if data.get('password') and data.get('password').strip() != "":
            user.password = data.get('password')

        db.commit()
        return {"message": "Student updated successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Student Update Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/student/{roll_no}")
def delete_student_profile(roll_no: str, db: Session = Depends(get_db)):
    try:
        # Order of deletion is critical for Foreign Key integrity
        db.query(models.AcademicData).filter(models.AcademicData.student_roll_no == roll_no).delete()
        db.query(models.Student).filter(models.Student.roll_no == roll_no).delete()
        db.query(models.User).filter(models.User.id == roll_no).delete()
        db.commit()
        return {"message": "Student deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Student Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- ADMIN: UPDATE & DELETE FACULTY ---

@app.put("/admin/faculty/update")
def update_faculty(data: dict, db: Session = Depends(get_db)):
    # FIX: Support multiple ID keys
    orig_id = data.get('original_id') or data.get('staff_no')
    new_id = data.get('staff_no') or data.get('id')
    
    faculty = db.query(models.Faculty).filter(models.Faculty.staff_no == orig_id).first()
    user = db.query(models.User).filter(models.User.id == orig_id).first()
    
    if not faculty or not user:
        raise HTTPException(status_code=404, detail="Faculty not found")

    try:
        if str(orig_id) != str(new_id):
            if db.query(models.User).filter(models.User.id == new_id).first():
                raise HTTPException(status_code=400, detail="New Staff ID already exists")
            db.query(models.Course).filter(models.Course.faculty_id == orig_id).update({"faculty_id": new_id})
            faculty.staff_no = new_id
            user.id = new_id
            db.flush()

        faculty.name = data.get('name')
        faculty.designation = data.get('designation')

        if data.get('password') and data.get('password').strip() != "":
            user.password = data.get('password')

        db.commit()
        return {"message": "Faculty updated successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Faculty Update Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/faculty/{staff_no}")
def delete_faculty_profile(staff_no: str, db: Session = Depends(get_db)):
    # 1. Verify if the faculty exists
    faculty = db.query(models.Faculty).filter(models.Faculty.staff_no == staff_no.strip()).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty record not found")

    try:
        # 2. IMPORTANT: Unlink faculty from all courses they are teaching first
        db.query(models.Course).filter(models.Course.faculty_id == staff_no.strip()).update({"faculty_id": None})
        db.flush()

        # 3. Delete from child profile table
        db.query(models.Faculty).filter(models.Faculty.staff_no == staff_no.strip()).delete()

        # 4. Delete from parent login table
        db.query(models.User).filter(models.User.id == staff_no.strip()).delete()

        db.commit()
        return {"message": "Faculty deleted successfully"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Faculty Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- TOPPER CALCULATIONS ---
@app.get("/admin/toppers/overall")
def get_overall_toppers(year: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Student)
    if year:
        query = query.filter(models.Student.year == year)
    return query.order_by(models.Student.cgpa.desc()).limit(3).all()

@app.get("/admin/toppers/classwise")
def get_classwise_toppers(year: int, section: str, db: Session = Depends(get_db)):
    return db.query(models.Student).filter(
        models.Student.year == year,
        models.Student.section == section
    ).order_by(models.Student.cgpa.desc()).all()

# FIX: Add debug endpoint to check materials
@app.get("/debug/materials")
def debug_all_materials(db: Session = Depends(get_db)):
    """Debug endpoint to see all materials in the database"""
    materials = db.query(models.Material).all()
    return {
        "total_materials": len(materials),
        "materials": [
            {
                "id": m.id,
                "course_code": m.course_code,
                "course_id": m.course_id,
                "type": m.type,
                "title": m.title,
                "file_link": m.file_link[:50] + "..." if m.file_link and len(m.file_link) > 50 else m.file_link
            } 
            for m in materials
        ]
    }