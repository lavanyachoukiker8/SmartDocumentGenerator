import type { Club } from "../types";

export const mockClub: Club = {
  id: "acm-svnit",
  shortName: "ACM",
  name: "Association for Computing Machinery — SVNIT Student Chapter",
  institute: "Sardar Vallabhbhai National Institute of Technology, Surat",
  department: "Computer Science & Engineering",
  branding: {
    logoLeft: "/logos/acm.svg",
    logoRight: "/logos/svnit.svg",
    primaryColor: "#4F81BD",
    darkColor: "#1F3A5F",
    headingFont: "Tinos",
    bodyFont: "Tinos",
    letterheadTitle: "ASSOCIATION for COMPUTING MACHINERY",
    letterheadSubtitle: "SARDAR VALLABHBHAI NATIONAL INSTITUTE OF TECHNOLOGY, SURAT",
  },
  defaultSubmittedTo: "HoD (CSE Dept.)",
  signatories: [
    { id: "sig-1", name: "Ansh Gupta", shortName: "Ansh", designation: "Chairperson, ACM", role: "Chairperson" },
    { id: "sig-2", name: "Arshad Khatib", shortName: "Arshad", designation: "Student Secretary, ACM", role: "Student Secretary" },
    { id: "sig-3", name: "Dr. Sankita J. Patel", shortName: "Dr. Sankita Patel", designation: "Assistant Professor, CSE", role: "Faculty Chairman" },
  ],
  referenceFormats: [
    { category: "ROOM", pattern: "ACM/{FY}/ROOM/{seq}", counter: 9 },
    { category: "BILL", pattern: "ACM/{FY}/BILL/{seq}", counter: 4 },
    { category: "SUM", pattern: "ACM/{FY}/SUM/{seq}", counter: 2 },
    { category: "GEN", pattern: "ACM/{FY}/GEN/{seq}", counter: 12 },
  ],
  academicYear: "2026-27",
  financialYear: "26-27",
};
