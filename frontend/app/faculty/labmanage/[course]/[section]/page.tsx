'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/config';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
    Save, FileUp, UserCheck, ArrowLeft, Search, Loader2, 
    Megaphone, Beaker, Trash2, Upload, BookOpen
} from 'lucide-react';

export default function LabManagementPage() {
    const params = useParams();
    const router = useRouter();
    const courseCode = params.course as string;
    const sectionName = params.section || "A";

    // States
    const [students, setStudents] = useState<any[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [uploadedManuals, setUploadedManuals] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeAction, setActiveAction] = useState('attendance');
    const [isSaving, setIsSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [labAnnouncement, setLabAnnouncement] = useState({ title: '', content: '' });

    // --- 1. INITIAL FETCH ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${API_URL}/marks/section?course_code=${courseCode}`);
                setStudents(res.data);
                setFilteredStudents(res.data);
            } catch (error) {
                console.error("Error fetching students", error);
            }
        };
        fetchData();
        fetchManuals();
    }, [courseCode]);

    // --- 2. MANUALS FETCH LOGIC ---
    const fetchManuals = async () => {
        try {
            const res = await axios.get(`${API_URL}/materials/${courseCode}`);
            // Filter only Lab Manuals for this lab course
            const labManuals = res.data.filter((m: any) => m.type === 'Lab Manual');
            setUploadedManuals(labManuals);
        } catch (e) {
            console.error("Error loading lab manuals");
        }
    };

    useEffect(() => {
        if (activeAction === 'manuals') fetchManuals();
    }, [activeAction]);

    // --- 3. DELETE MANUAL LOGIC ---
    const handleDeleteManual = async (id: number) => {
        if (!confirm("⚠️ Are you sure you want to delete this lab manual?")) return;
        try {
            await axios.delete(`${API_URL}/materials/${id}`);
            alert("🗑️ Lab manual removed!");
            fetchManuals();
        } catch (error) {
            alert("Delete failed.");
        }
    };

    // --- 4. SEARCH LOGIC ---
    useEffect(() => {
        const filtered = students.filter(s =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.roll_no.includes(searchQuery)
        );
        setFilteredStudents(filtered);
    }, [searchQuery, students]);

    const handleAttendanceChange = (roll_no: string, value: string) => {
        const updated = students.map(s => 
            s.roll_no === roll_no ? { ...s, subject_attendance: value } : s
        );
        setStudents(updated);
    };

    // --- 5. SAVE ATTENDANCE DATA ---
    const handleSaveAttendance = async () => {
        setIsSaving(true);
        try {
            const savePromises = students.map(student =>
                axios.post(`${API_URL}/marks/sync`, {
                    student_roll_no: student.roll_no,
                    course_code: courseCode,
                    cia1_marks: 0,
                    cia1_retest: 0,
                    cia2_marks: 0,
                    cia2_retest: 0,
                    subject_attendance: Number(student.subject_attendance)
                })
            );
            await Promise.all(savePromises);
            alert(`✅ Attendance data synced successfully!`);
        } catch (error) {
            alert("Failed to sync attendance data.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- 6. LAB MANUAL UPLOAD LOGIC ---
    const handleManualUpload = async () => {
        const titleInput = document.getElementById('manual-title') as HTMLInputElement;
        const fileInput = document.getElementById('manual-file') as HTMLInputElement;
        const userId = localStorage.getItem('user_id');

        if (!titleInput?.value || !fileInput?.files?.[0]) { 
            alert("Please provide both manual title and file!"); 
            return; 
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]); 
        formData.append('course_code', courseCode);
        formData.append('type', 'Lab Manual');
        formData.append('title', titleInput.value);
        formData.append('posted_by', userId!);

        setUploading(true);
        try {
            await axios.post(`${API_URL}/materials`, formData);
            alert(`📚 Lab manual uploaded!`);
            titleInput.value = "";
            fileInput.value = "";
            fetchManuals();
        } catch (error) {
            alert("Upload failed.");
        } finally {
            setUploading(false);
        }
    };

    // --- 7. LAB ANNOUNCEMENT POST ---
    const handlePostLabAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/announcements`, {
                title: labAnnouncement.title,
                content: labAnnouncement.content,
                type: "Lab", 
                course_code: courseCode,
                posted_by: localStorage.getItem('user_id'),
                section: sectionName
            });
            alert(`🔬 Lab notice broadcasted to students!`);
            setLabAnnouncement({ title: '', content: '' });
        } catch (error) {
            alert("Failed to post lab announcement.");
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Navbar />
            <div className="container mx-auto px-4 py-8 flex-grow">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <button onClick={() => router.push('/faculty')} className="flex items-center gap-2 text-purple-700 font-bold hover:underline mb-2">
                            <ArrowLeft size={18} /> Back to Dashboard
                        </button>
                        <h1 className="text-3xl font-black uppercase text-purple-700">
                            {courseCode} Lab Management
                        </h1>
                        <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Section {sectionName}</p>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setActiveAction('attendance')} className={`px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition ${activeAction === 'attendance' ? 'bg-purple-700 text-white shadow-lg' : 'bg-white border text-gray-600'}`}>
                            <UserCheck size={18} /> Attendance
                        </button>
                        <button onClick={() => setActiveAction('manuals')} className={`px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition ${activeAction === 'manuals' ? 'bg-purple-700 text-white shadow-lg' : 'bg-white border text-gray-600'}`}>
                            <BookOpen size={18} /> Lab Manuals
                        </button>
                    </div>
                </div>

                {/* TAB 1: ATTENDANCE TABLE */}
                {activeAction === 'attendance' && (
                    <div className="bg-white rounded-xl shadow-md border overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row justify-between gap-4">
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input type="text" placeholder="Search Roll No..." className="pl-10 pr-4 py-2 w-full border rounded-lg outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <button onClick={handleSaveAttendance} disabled={isSaving} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Attendance
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-white text-[10px] uppercase tracking-wider font-bold bg-purple-700">
                                    <tr>
                                        <th className="p-4">Roll No</th>
                                        <th className="p-4">Name</th>
                                        <th className="p-4 text-center">Lab Attendance %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((stu) => (
                                        <tr key={stu.roll_no} className="hover:bg-purple-50 border-b transition text-sm">
                                            <td className="p-4 font-bold text-gray-700">{stu.roll_no}</td>
                                            <td className="p-4 text-gray-800 font-medium">{stu.name}</td>
                                            <td className="p-4 text-center">
                                                <input 
                                                    type="number" 
                                                    value={stu.subject_attendance} 
                                                    onChange={(e) => handleAttendanceChange(stu.roll_no, e.target.value)} 
                                                    className="w-16 border rounded p-2 text-center font-bold bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500"
                                                    min="0"
                                                    max="100"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 2: LAB MANUALS MANAGEMENT */}
                {activeAction === 'manuals' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* UPLOAD LAB MANUAL CARD */}
                        <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-purple-600">
                            <div className="flex items-center gap-2 mb-6">
                                <Beaker className="text-purple-600" size={24} />
                                <h3 className="text-xl font-bold text-purple-900">Upload Lab Manual</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Manual Title</label>
                                    <input 
                                        type="text" 
                                        id="manual-title" 
                                        placeholder="e.g., Java Programming Lab Manual" 
                                        className="w-full border-2 border-gray-200 p-3 rounded-lg outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">PDF File</label>
                                    <input 
                                        type="file" 
                                        id="manual-file" 
                                        accept=".pdf,.doc,.docx"
                                        className="w-full border-2 border-gray-200 p-3 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-bold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
                                    />
                                </div>
                            </div>
                            <button 
                                disabled={uploading} 
                                onClick={handleManualUpload} 
                                className="mt-8 w-full bg-purple-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} /> Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={20} /> Upload Lab Manual
                                    </>
                                )}
                            </button>
                        </div>

                        {/* MANAGE UPLOADED MANUALS */}
                        <div className="bg-white rounded-xl shadow-lg border border-red-100 overflow-hidden">
                            <div className="p-6 bg-red-50 border-b border-red-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Trash2 size={18} className="text-red-600" />
                                    <h3 className="font-bold text-red-800 uppercase text-sm tracking-wider">Manage Uploaded Manuals</h3>
                                </div>
                                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full">
                                    {uploadedManuals.length} manual{uploadedManuals.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 border-b">
                                        <tr>
                                            <th className="p-4">Title</th>
                                            <th className="p-4">Uploaded By</th>
                                            <th className="p-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {uploadedManuals.length > 0 ? (
                                            uploadedManuals.map((manual) => (
                                                <tr key={manual.id} className="border-b last:border-0 hover:bg-red-50/30 transition">
                                                    <td className="p-4 font-bold text-gray-700 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <BookOpen size={16} className="text-purple-500" />
                                                            {manual.title}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-gray-600 text-xs">{manual.posted_by}</td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <a 
                                                                href={manual.file_link} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition"
                                                            >
                                                                <FileUp size={18} />
                                                            </a>
                                                            <button 
                                                                onClick={() => handleDeleteManual(manual.id)} 
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={3} className="p-10 text-center text-gray-400 italic">
                                                    No lab manuals uploaded yet. Upload your first manual above.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* LAB ANNOUNCEMENT FORM */}
                        <div className="bg-white p-8 rounded-xl shadow-md border-l-4 border-blue-900">
                            <h2 className="text-xl font-bold text-blue-900 mb-6 flex items-center gap-2">
                                <Megaphone className="text-orange-500" /> Post Lab Announcement
                            </h2>
                            <p className="text-gray-600 mb-6 text-sm">
                                This announcement will appear in the student's <strong>Lab</strong> tab for this subject.
                            </p>
                            <form onSubmit={handlePostLabAnnouncement} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Announcement Title</label>
                                    <input 
                                        className="w-full p-4 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                        placeholder="e.g., Lab Schedule Change or Important Instructions..." 
                                        value={labAnnouncement.title} 
                                        onChange={(e) => setLabAnnouncement({ ...labAnnouncement, title: e.target.value })} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Details</label>
                                    <textarea 
                                        className="w-full p-4 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 h-32"
                                        placeholder="Provide detailed information for students..." 
                                        value={labAnnouncement.content} 
                                        onChange={(e) => setLabAnnouncement({ ...labAnnouncement, content: e.target.value })} 
                                        required 
                                    />
                                </div>
                                <button 
                                    type="submit" 
                                    className="w-full bg-blue-900 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-800 transition"
                                >
                                    Broadcast Lab Announcement
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
}