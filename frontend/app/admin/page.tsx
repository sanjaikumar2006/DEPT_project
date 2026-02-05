'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/config';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
    Users, GraduationCap, UserCog, ArrowLeft, 
    Search, Trash2, BookOpen, PlusCircle, Bell, Trophy, Link as LinkIcon, Edit2, X, ChevronDown 
} from 'lucide-react';

// Searchable Dropdown Component
function SearchableDropdown({ 
    options, 
    value, 
    onChange, 
    placeholder = "-- Select --",
    displayKey = "name",
    valueKey = "id",
    className = ""
}: {
    options: any[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    displayKey?: string;
    valueKey?: string;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter((option) =>
        option[displayKey]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option[valueKey]?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find(opt => opt[valueKey] === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-2.5 border rounded-lg bg-gray-50 text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
                <span className={selectedOption ? "text-gray-900 font-medium" : "text-gray-400"}>
                    {selectedOption 
                        ? `${selectedOption[displayKey]} (${selectedOption[valueKey]})`
                        : placeholder
                    }
                </span>
                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-hidden">
                    <div className="p-2 border-b sticky top-0 bg-white">
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                            <Search size={16} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search faculty..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent outline-none text-sm w-full"
                                autoFocus
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto max-h-48">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <button
                                    key={option[valueKey]}
                                    type="button"
                                    onClick={() => handleSelect(option[valueKey])}
                                    className={`w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors ${
                                        value === option[valueKey] ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700'
                                    }`}
                                >
                                    <div className="font-medium">{option[displayKey]}</div>
                                    <div className="text-xs text-gray-500">{option[valueKey]}</div>
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-gray-400 text-sm">
                                No faculty found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('announcements');
    const [listSubView, setListSubView] = useState<'none' | 'students' | 'faculties'>('none');

    // --- Filter States ---
    const [filterYear, setFilterYear] = useState('');
    const [filterSem, setFilterSem] = useState('');
    const [filterSec, setFilterSec] = useState('');
    const [filterDesignation, setFilterDesignation] = useState('');
    const [filterFacSec, setFilterFacSec] = useState('');
    
    // --- Search State ---
    const [searchQuery, setSearchQuery] = useState('');

    // --- Modal State for Editing ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);

    // --- Bulk Upload State ---
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkRole, setBulkRole] = useState('Student');

    // State for Announcements
    const [announcementTitle, setAnnouncementTitle] = useState('');
    const [announcementContent, setAnnouncementContent] = useState('');
    const [announcementType, setAnnouncementType] = useState('Global');

    // --- State for Sem Result Link ---
    const [resultTitle, setResultTitle] = useState('');
    const [resultUrl, setResultUrl] = useState('');
    const [resultLinks, setResultLinks] = useState<any[]>([]); 

    // State for User Creation
    const [userData, setUserData] = useState({
        id: '', name: '', role: 'Student', password: '', 
        year: 1, semester: 1, section: 'A', designation: 'Assistant Professor', doj: ''
    });

    // State for Course Management
    const [courseData, setCourseData] = useState({ 
        code: '', title: '', year: 1, semester: 1, credits: 3, section: 'A', faculty_id: '' 
    });

    const [labData, setLabData] = useState({ 
        code: '', title: '', year: 1, semester: 1, credits: 2, section: 'A', faculty_id: '' 
    });

    const [courses, setCourses] = useState([]);
    const [faculties, setFaculties] = useState([]); 
    const [studentsList, setStudentsList] = useState([]); 

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');

        if (!token || role !== 'Admin') {
            router.push('/login');
            return;
        }
        fetchCourses();
        fetchFaculties(); 
    }, [router]);

    useEffect(() => {
        if (activeTab === 'sem result link') {
            fetchResultLinks();
        }
    }, [activeTab]);

    useEffect(() => {
        if (listSubView === 'students') fetchStudents();
    }, [filterYear, filterSem, filterSec, listSubView]);

    useEffect(() => {
        if (listSubView === 'faculties') fetchFaculties();
    }, [filterDesignation, filterFacSec, listSubView]);

    const fetchCourses = async () => {
        try {
            const res = await axios.get(`${API_URL}/courses`);
            setCourses(res.data);
        } catch (err) { console.error("Fetch Courses Error:", err); }
    };

    const fetchFaculties = async () => {
        try {
            const params = new URLSearchParams();
            if (filterDesignation) params.append('designation', filterDesignation);
            const res = await axios.get(`${API_URL}/admin/faculties?${params.toString()}`);
            setFaculties(res.data);
        } catch (err) { console.error("Fetch Faculty Error:", err); }
    };

    const fetchStudents = async () => {
        try {
            const params = new URLSearchParams();
            if (filterYear) params.append('year', filterYear);
            if (filterSem) params.append('semester', filterSem);
            if (filterSec) params.append('section', filterSec);

            const res = await axios.get(`${API_URL}/admin/students?${params.toString()}`);
            setStudentsList(res.data);
        } catch (err) { console.error("Fetch Student Error:", err); }
    };

    const fetchResultLinks = async () => {
        try {
            const res = await axios.get(`${API_URL}/materials/Global`);
            setResultLinks(res.data.filter((m: any) => m.type === 'Result Link'));
        } catch (err) { console.error("Error fetching links", err); }
    };

    const filteredResults = (listSubView === 'students' ? studentsList : faculties).filter((user: any) => {
        const query = searchQuery.toLowerCase();
        const nameMatch = user.name?.toLowerCase().includes(query);
        const idMatch = (user.roll_no || user.staff_no)?.toLowerCase().includes(query);
        return nameMatch || idMatch;
    });

    // --- HANDLERS ---
    const handleDeleteUser = async (id: string, role: string) => {
        if (!confirm(`Permanently delete ${role} ${id}?`)) return;
        try {
            const endpoint = role === 'Student' ? `/student/${id}` : `/faculty/${id}`;
            await axios.delete(`${API_URL}${endpoint}`);
            alert(`${role} deleted successfully!`);
            role === 'Student' ? fetchStudents() : fetchFaculties();
        } catch (err) { alert("Delete failed. Check backend connection."); }
    };

    const handleEditClick = (user: any, role: string) => {
        setEditingUser({ 
            ...user, 
            user_role: role, 
            password: '', 
            roll_no: user.roll_no || '', 
            staff_no: user.staff_no || '',
            original_roll_no: user.roll_no,
            original_id: user.staff_no
        });
        setIsEditModalOpen(true);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const endpoint = editingUser.user_role === 'Student' ? '/admin/student/update' : '/admin/faculty/update';
            await axios.put(`${API_URL}${endpoint}`, editingUser);
            alert(`${editingUser.user_role} updated successfully!`);
            setIsEditModalOpen(false);
            editingUser.user_role === 'Student' ? fetchStudents() : fetchFaculties();
        } catch (err) {
            alert("Update failed.");
        }
    };

    const handleBulkUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bulkFile) return alert("Please select a CSV file");
        const formData = new FormData();
        formData.append('file', bulkFile);
        try {
            const res = await axios.post(`${API_URL}/admin/bulk-upload/${bulkRole}`, formData);
            alert(res.data.message);
            setBulkFile(null);
            fetchStudents(); fetchFaculties();
        } catch (err) { alert("Bulk upload failed."); }
    };

    const handlePostAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/announcements`, {
                title: announcementTitle, content: announcementContent,
                type: announcementType, posted_by: 'Admin', course_code: 'Global'
            });
            alert("Announcement posted!");
            setAnnouncementTitle(''); setAnnouncementContent('');
        } catch (err) { alert('Failed to post announcement'); }
    };

    const handlePostResultLink = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('course_code', 'Global');
            formData.append('type', 'Result Link');
            formData.append('title', resultTitle);
            formData.append('url', resultUrl);
            formData.append('posted_by', 'Admin');

            await axios.post(`${API_URL}/materials`, formData);
            alert("✅ Semester Result link published!");
            setResultTitle(''); setResultUrl('');
            fetchResultLinks();
        } catch (err) { alert('Failed to upload result link'); }
    };

    const handleDeleteLink = async (id: number) => {
        if (!confirm("Are you sure you want to delete this result link?")) return;
        try {
            await axios.delete(`${API_URL}/materials/${id}`);
            alert("Link deleted successfully");
            fetchResultLinks();
        } catch (err) { alert("Failed to delete link"); }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...userData,
                year: Number(userData.year),
                semester: Number(userData.semester),
                section: userData.role === 'Student' ? userData.section : 'N/A'
            };
            await axios.post(`${API_URL}/admin/create-user`, payload);
            alert(`${userData.role} created successfully!`);
            setUserData({ id: '', name: '', role: 'Student', password: '', year: 1, semester: 1, section: 'A', designation: 'Assistant Professor', doj: '' });
            fetchFaculties(); fetchStudents();
        } catch (err: any) { alert("Error creating user"); }
    };

    const handleAddSubject = async (e: React.FormEvent, data: any, isLab: boolean) => {
        e.preventDefault();
        try {
            const payload = {
                ...data,
                title: isLab && !data.title.includes('(Lab)') ? `${data.title} (Lab)` : data.title,
                year: Number(data.year),
                semester: Number(data.semester),
                credits: Number(data.credits)
            };
            await axios.post(`${API_URL}/admin/courses`, payload);
            alert("Subject added!");
            
            // Clear the form
            if (activeTab === 'courses') {
                setCourseData({ code: '', title: '', year: 1, semester: 1, credits: 3, section: 'A', faculty_id: '' });
            } else {
                setLabData({ code: '', title: '', year: 1, semester: 1, credits: 2, section: 'A', faculty_id: '' });
            }
            
            fetchCourses();
        } catch (err: any) { alert("Failed to add subject"); }
    };

    const handleDeleteCourse = async (id: number) => {
        if (!confirm(`Delete subject?`)) return;
        try {
            await axios.delete(`${API_URL}/admin/courses/${id}`);
            fetchCourses();
        } catch (err) { alert('Error deleting course'); }
    };

    const onTabClick = (tab: string) => {
        if (tab === 'topper') {
            router.push('/admin/topper');
        } else {
            setActiveTab(tab);
            setListSubView('none');
            setSearchQuery('');
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Navbar />
            <div className="container mx-auto px-4 py-8 flex-grow">
                <h1 className="text-3xl font-bold mb-8 text-blue-900 tracking-tight flex items-center gap-3">
                    <UserCog size={32} /> Admin Control Panel
                </h1>

                <div className="flex space-x-6 mb-8 border-b overflow-x-auto no-scrollbar">
                    {['announcements', 'create user', 'list student/faculty', 'courses', 'labs', 'topper', 'sem result link'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => onTabClick(tab)}
                            className={`pb-3 px-2 capitalize transition-all duration-200 whitespace-nowrap font-bold ${
                                activeTab === tab 
                                ? 'border-b-2 border-blue-600 text-blue-600' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                    
                    {activeTab === 'announcements' && (
                        <div className="animate-in fade-in duration-300">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Bell className="text-blue-600" /> Publish Announcement</h2>
                            <form onSubmit={handlePostAnnouncement} className="space-y-4 max-w-lg">
                                <select value={announcementType} onChange={(e) => setAnnouncementType(e.target.value)} className="w-full p-2.5 border rounded-lg bg-gray-50">
                                    <option value="Global">Global (All Users)</option>
                                    <option value="Faculty">Faculties Only</option>
                                    <option value="Student">Students Only</option>
                                </select>
                                <input type="text" placeholder="Title" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
                                <textarea placeholder="Message Content..." value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" rows={5} required />
                                <button type="submit" className="bg-blue-900 text-white px-8 py-2.5 rounded-lg hover:bg-blue-800 transition-colors font-semibold shadow-md">Broadcast</button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'sem result link' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div>
                                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><LinkIcon className="text-blue-600" /> Upload Link</h2>
                                    <p className="text-[10px] text-red-600 font-bold mb-6 uppercase tracking-wider italic">
                                        * Note: Published links will be visible in the Student Result Portal immediately.
                                    </p>
                                    <form onSubmit={handlePostResultLink} className="space-y-4">
                                        <input type="text" placeholder="Result Title (e.g., Nov/Dec 2025 Results)" value={resultTitle} onChange={(e) => setResultTitle(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
                                        <input type="url" placeholder="Paste Portal URL (https://...)" value={resultUrl} onChange={(e) => setResultUrl(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
                                        <button type="submit" className="bg-blue-900 text-white px-8 py-2.5 rounded-lg hover:bg-blue-800 font-bold shadow-md w-full transition-all">Publish Result Link</button>
                                    </form>
                                </div>
                                <div className="border-l lg:pl-12">
                                    <h2 className="text-xl font-bold mb-6 text-gray-800 uppercase tracking-tighter">Active Result Links</h2>
                                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                                        {resultLinks.length > 0 ? resultLinks.map((link) => (
                                            <div key={link.id} className="p-4 border rounded-xl bg-gray-50 flex justify-between items-center group hover:bg-white transition-all shadow-sm">
                                                <div className="overflow-hidden">
                                                    <p className="font-bold text-blue-900 truncate">{link.title}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono truncate">{link.file_link}</p>
                                                </div>
                                                <button onClick={() => handleDeleteLink(link.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )) : <p className="text-center py-10 text-gray-400 italic text-sm">No active result links.</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'list student/faculty' && (
                        <div className="animate-in fade-in duration-300">
                            {listSubView === 'none' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-10">
                                    <div onClick={() => setListSubView('students')} className="group cursor-pointer bg-blue-50 p-10 rounded-2xl border-2 border-transparent hover:border-blue-500 hover:shadow-xl transition-all text-center">
                                        <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform">
                                            <GraduationCap size={40} />
                                        </div>
                                        <h3 className="text-2xl font-black text-blue-900 mb-2 uppercase tracking-tighter">Student Database</h3>
                                        <p className="text-gray-600">View enrolled students</p>
                                    </div>

                                    <div onClick={() => setListSubView('faculties')} className="group cursor-pointer bg-purple-50 p-10 rounded-2xl border-2 border-transparent hover:border-purple-500 hover:shadow-xl transition-all text-center">
                                        <div className="w-20 h-20 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform">
                                            <Users size={40} />
                                        </div>
                                        <h3 className="text-2xl font-black text-purple-900 mb-2 uppercase tracking-tighter">Faculty Registry</h3>
                                        <p className="text-gray-600">Manage teaching staff</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <button onClick={() => {setListSubView('none'); setSearchQuery('');}} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-blue-600 font-bold transition-colors">
                                        <ArrowLeft size={20} /> Back to Selection
                                    </button>

                                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                                        <h2 className="text-2xl font-black uppercase text-gray-800 tracking-tight">
                                            {listSubView === 'students' ? 'Student List' : 'Faculty List'}
                                        </h2>
                                        <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-2 border w-full md:w-auto">
                                            <Search size={18} className="text-gray-400" />
                                            <input type="text" placeholder="Search..." className="bg-transparent outline-none text-sm w-full md:w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                                                <tr>
                                                    <th className="p-4">ID/Roll No</th>
                                                    <th className="p-4">Name</th>
                                                    <th className="p-4">{listSubView === 'students' ? 'Section' : 'Designation'}</th>
                                                    <th className="p-4">{listSubView === 'students' ? 'Semester' : 'Joining Date'}</th>
                                                    {listSubView === 'students' && <th className="p-4">Year</th>}
                                                    {listSubView === 'students' && <th className="p-4">CGPA</th>}
                                                    <th className="p-4 text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {filteredResults.map((user: any) => (
                                                    <tr key={user.roll_no || user.staff_no} className="hover:bg-gray-50 transition-colors">
                                                        <td className="p-4 font-mono font-bold text-blue-600">{user.roll_no || user.staff_no}</td>
                                                        <td className="p-4 font-bold text-gray-800">{user.name}</td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${listSubView === 'students' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                                                {user.section || user.designation}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-gray-500 text-sm">{user.semester || user.doj}</td>
                                                        {listSubView === 'students' && <td className="p-4 text-gray-500 text-sm">{user.year}</td>}
                                                        {listSubView === 'students' && (
                                                            <td className="p-4 font-black text-blue-900">{user.cgpa?.toFixed(2) || '0.00'}</td>
                                                        )}
                                                        <td className="p-4">
                                                            <div className="flex justify-center gap-2">
                                                                <button onClick={() => handleEditClick(user, listSubView === 'students' ? 'Student' : 'Faculty')} className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors">
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button onClick={() => handleDeleteUser(user.roll_no || user.staff_no, listSubView === 'students' ? 'Student' : 'Faculty')} className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'create user' && (
                        <div className="animate-in fade-in duration-300">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><PlusCircle className="text-blue-600" /> Register New Member</h2>
                            <p className="text-[10px] text-red-600 font-bold mb-6 uppercase tracking-wider italic">* Create subjects before creating students for particular sem.</p>
                            
                            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mb-12">
                                <input type="text" placeholder="User ID" value={userData.id} onChange={(e) => setUserData({...userData, id: e.target.value})} className="w-full p-2.5 border rounded-lg" required />
                                <input type="text" placeholder="Full Name" value={userData.name} onChange={(e) => setUserData({...userData, name: e.target.value})} className="w-full p-2.5 border rounded-lg" required />
                                <select value={userData.role} onChange={(e) => setUserData({...userData, role: e.target.value})} className="w-full p-2.5 border rounded-lg bg-white">
                                    <option value="Student">Student</option>
                                    <option value="Faculty">Faculty</option>
                                </select>
                                <input type="password" placeholder="Initial Password" value={userData.password} onChange={(e) => setUserData({...userData, password: e.target.value})} className="w-full p-2.5 border rounded-lg" required />
                                {userData.role === 'Student' ? (
                                    <>
                                        <input type="number" placeholder="Year" value={userData.year} onChange={(e) => setUserData({...userData, year: Number(e.target.value)})} className="w-full p-2.5 border rounded-lg" />
                                        <input type="number" placeholder="Semester" value={userData.semester} onChange={(e) => setUserData({...userData, semester: Number(e.target.value)})} className="w-full p-2.5 border rounded-lg" />
                                        <select value={userData.section} onChange={(e) => setUserData({...userData, section: e.target.value})} className="md:col-span-2 w-full p-2.5 border rounded-lg bg-orange-50 font-bold text-orange-700">
                                            <option value="A">Section A</option><option value="B">Section B</option><option value="C">Section C</option>
                                        </select>
                                    </>
                                ) : (
                                    <>
                                        <select value={userData.designation} onChange={(e) => setUserData({...userData, designation: e.target.value})} className="w-full p-2.5 border rounded-lg bg-white">
                                            <option value="Professor">Professor</option>
                                            <option value="Associate Professor">Associate Professor</option>
                                            <option value="Assistant Professor">Assistant Professor</option>
                                            <option value="Lecturer">Lecturer</option>
                                            <option value="Lab Instructor">Lab Instructor</option>
                                        </select>
                                        <input type="text" placeholder="DOJ (DD.MM.YYYY)" value={userData.doj} onChange={(e) => setUserData({...userData, doj: e.target.value})} className="w-full p-2.5 border rounded-lg" />
                                    </>
                                )}
                                <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg md:col-span-2 font-bold shadow-lg hover:bg-blue-700 transition-all">Complete Registration</button>
                            </form>

                            <div className="border-t pt-8">
                                <h2 className="text-xl font-bold mb-4 text-green-700 flex items-center gap-2"><LinkIcon /> Bulk Upload via CSV</h2>
                                <form onSubmit={handleBulkUpload} className="flex flex-wrap gap-4 items-end bg-green-50 p-6 rounded-xl border border-green-100">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-green-600">Select Role</label>
                                        <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)} className="p-2.5 border rounded-lg bg-white outline-none">
                                            <option value="Student">Students</option>
                                            <option value="Faculty">Faculty</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-green-600">Choose CSV File</label>
                                        <input type="file" accept=".csv" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} className="p-2 border rounded-lg bg-white text-sm" />
                                    </div>
                                    <button type="submit" className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 shadow-md">Upload All</button>
                                </form>
                            </div>
                        </div>
                    )}

                    {(activeTab === 'courses' || activeTab === 'labs') && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold mb-1 text-gray-800">Add New {activeTab === 'courses' ? 'Theory Subject' : 'Laboratory'}</h2>
                                <p className="text-[10px] text-red-600 font-bold mb-6 uppercase tracking-wider italic">* Note: Create subjects before creating students for particular sem.</p>
                                <form onSubmit={(e) => handleAddSubject(e, activeTab === 'courses' ? courseData : labData, activeTab === 'labs')} className="space-y-4">
                                    <input type="text" placeholder="Code" value={activeTab === 'courses' ? courseData.code : labData.code} onChange={(e) => activeTab === 'courses' ? setCourseData({...courseData, code: e.target.value}) : setLabData({...labData, code: e.target.value})} className="w-full p-2.5 border rounded-lg" required />
                                    
                                    <input type="text" placeholder="Subject Name" value={activeTab === 'courses' ? courseData.title : labData.title} onChange={(e) => activeTab === 'courses' ? setCourseData({...courseData, title: e.target.value}) : setLabData({...labData, title: e.target.value})} className="w-full p-2.5 border rounded-lg" required />
                                    
                                    <div className="flex space-x-4">
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Year</label>
                                            <select 
                                                value={activeTab === 'courses' ? courseData.year || 1 : labData.year || 1} 
                                                onChange={(e) => activeTab === 'courses' 
                                                    ? setCourseData({...courseData, year: Number(e.target.value)}) 
                                                    : setLabData({...labData, year: Number(e.target.value)})} 
                                                className="w-full p-2.5 border rounded-lg bg-white font-medium"
                                            >
                                                <option value={1}>1st Year</option>
                                                <option value={2}>2nd Year</option>
                                                <option value={3}>3rd Year</option>
                                                <option value={4}>4th Year</option>
                                            </select>
                                        </div>
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Sem</label>
                                            <select 
                                                value={activeTab === 'courses' ? courseData.semester : labData.semester} 
                                                onChange={(e) => activeTab === 'courses' 
                                                    ? setCourseData({...courseData, semester: Number(e.target.value)}) 
                                                    : setLabData({...labData, semester: Number(e.target.value)})} 
                                                className="w-full p-2.5 border rounded-lg bg-white font-medium"
                                            >
                                                <option value={1}>1st Sem</option>
                                                <option value={2}>2nd Sem</option>
                                                <option value={3}>3rd Sem</option>
                                                <option value={4}>4th Sem</option>
                                                <option value={5}>5th Sem</option>
                                                <option value={6}>6th Sem</option>
                                                <option value={7}>7th Sem</option>
                                                <option value={8}>8th Sem</option>
                                            </select>
                                        </div>
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Credits</label>
                                            <input 
                                                type="number" 
                                                placeholder="3" 
                                                value={activeTab === 'courses' ? courseData.credits : labData.credits} 
                                                onChange={(e) => activeTab === 'courses' 
                                                    ? setCourseData({...courseData, credits: Number(e.target.value)}) 
                                                    : setLabData({...labData, credits: Number(e.target.value)})} 
                                                className="w-full p-2.5 border rounded-lg" 
                                            />
                                        </div>
                                    </div>
                                    <select value={activeTab === 'courses' ? courseData.section : labData.section} onChange={(e) => activeTab === 'courses' ? setCourseData({...courseData, section: e.target.value}) : setLabData({...labData, section: e.target.value})} className="w-full p-2.5 border rounded-lg bg-orange-50 font-bold">
                                        <option value="A">Section A</option><option value="B">Section B</option><option value="C">Section C</option>
                                    </select>
                                    
                                    {/* Searchable Faculty Dropdown */}
                                    <SearchableDropdown
                                        options={faculties}
                                        value={activeTab === 'courses' ? courseData.faculty_id : labData.faculty_id}
                                        onChange={(value) => activeTab === 'courses' 
                                            ? setCourseData({...courseData, faculty_id: value}) 
                                            : setLabData({...labData, faculty_id: value})
                                        }
                                        placeholder="-- Assign Faculty --"
                                        displayKey="name"
                                        valueKey="staff_no"
                                        className="w-full"
                                    />
                                    
                                    <button type="submit" className={`p-2.5 rounded-lg w-full font-bold text-white ${activeTab === 'courses' ? 'bg-green-600' : 'bg-purple-600'}`}>Create Subject</button>
                                </form>
                            </div>
                            <SyllabusList courses={courses.filter((c:any) => activeTab === 'labs' ? c.title.includes('(Lab)') : !c.title.includes('(Lab)'))} onDelete={handleDeleteCourse} title={activeTab === 'courses' ? "Active Syllabus" : "Active Laboratories"} />
                        </div>
                    )}
                </div>
            </div>

            {/* --- UNIVERSAL EDIT POPUP MODAL (STUDENT & FACULTY) --- */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-blue-900 p-6 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
                                <UserCog size={24} /> 
                                {editingUser.user_role === 'Student' ? 'Edit Student Profile' : 'Faculty Edit'}
                            </h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="hover:rotate-90 transition-transform">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUpdateUser} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {editingUser.user_role === 'Student' ? (
                                <>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Roll Number / ID</label>
                                        <input type="text" value={editingUser.roll_no || ''} onChange={(e) => setEditingUser({...editingUser, roll_no: e.target.value})} className="w-full p-2.5 border rounded-lg font-mono font-bold bg-gray-50" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Full Name</label>
                                        <input type="text" value={editingUser.name || ''} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold" required />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Academic Year</label>
                                        <select value={editingUser.year || 1} onChange={(e) => setEditingUser({...editingUser, year: Number(e.target.value)})} className="w-full p-2.5 border rounded-lg font-bold bg-white">
                                            <option value={1}>1st Year</option><option value={2}>2nd Year</option><option value={3}>3rd Year</option><option value={4}>4th Year</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Section</label>
                                        <select value={editingUser.section || 'A'} onChange={(e) => setEditingUser({...editingUser, section: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold">
                                            <option value="A">Section A</option><option value="B">Section B</option><option value="C">Section C</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Current Semester</label>
                                        <input type="number" value={editingUser.semester || 1} onChange={(e) => setEditingUser({...editingUser, semester: Number(e.target.value)})} className="w-full p-2.5 border rounded-lg font-bold" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400">CGPA</label>
                                        <input type="number" step="0.01" value={editingUser.cgpa || 0} onChange={(e) => setEditingUser({...editingUser, cgpa: Number(e.target.value)})} className="w-full p-2.5 border rounded-lg font-black text-blue-600 bg-blue-50/50" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400">HTS No / Staff No</label>
                                        <input type="text" value={editingUser.staff_no || ''} onChange={(e) => setEditingUser({...editingUser, staff_no: e.target.value})} className="w-full p-2.5 border rounded-lg font-mono font-bold bg-gray-50" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Faculty Name</label>
                                        <input type="text" value={editingUser.name || ''} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold" required />
                                    </div>
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Designation</label>
                                        <select value={editingUser.designation || ''} onChange={(e) => setEditingUser({...editingUser, designation: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold">
                                            <option value="Professor">Professor</option>
                                            <option value="Associate Professor">Associate Professor</option>
                                            <option value="Assistant Professor">Assistant Professor</option>
                                            <option value="Lecturer">Lecturer</option>
                                            <option value="Lab Instructor">Lab Instructor</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-[10px] font-black uppercase text-gray-400">Update Password (Leave blank to keep current)</label>
                                <input type="password" value={editingUser.password || ''} onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} placeholder="••••••••" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>

                            <div className="md:col-span-2 flex gap-4 mt-4">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 border-2 border-gray-100 rounded-xl font-black uppercase text-xs tracking-widest text-gray-400 hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700 transition-all">Update Details</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}

function SyllabusList({ courses, onDelete, title }: any) {
    return (
        <div>
            <h2 className="text-xl font-bold mb-6 text-gray-800 tracking-tighter uppercase">{title}</h2>
            <div className="max-h-[450px] overflow-y-auto border rounded-xl divide-y">
                {courses.length > 0 ? courses.map((c: any) => (
                    <div key={c.id || c.code} className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                        <div>
                            <p className="font-bold text-blue-900">{c.code} - Sec {c.section}</p>
                            <p className="text-sm text-gray-600">{c.title} (Sem {c.semester})</p>
                            <p className="text-[10px] font-bold text-blue-500 uppercase mt-1">Faculty: {c.faculty_id}</p>
                        </div>
                        <button onClick={() => onDelete(c.id || c.code)} className="text-red-500 hover:bg-red-50 px-3 py-1 rounded-md text-sm font-medium transition-colors">Delete</button>
                    </div>
                )) : <p className="p-8 text-center text-gray-400 italic">No records found.</p>}
            </div>
        </div>
    );
}