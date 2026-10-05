"use client";

import Image from "next/image";
import type { Club, FieldValues, TableRow } from "@/lib/types";
import { asRows, asText, isEmptyValue, maskValue, sumColumn, amountInWords } from "@/lib/fields";
import { formatDate, formatDateRange, formatDateSlash, formatTime, formatCurrency } from "@/lib/format";

interface A4DocumentPreviewProps {
  templateId: string;
  values: FieldValues;
  club: Club;
}

export function A4DocumentPreview({ templateId, values, club }: A4DocumentPreviewProps) {
  const renderValue = (key: string, fallback = "[TO BE FILLED]", isSensitive = false) => {
    const val = values[key];
    if (isEmptyValue(val)) {
      return (
        <span className="bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded font-mono text-xs border border-yellow-300 print:bg-transparent print:border-none print:text-black">
          {fallback}
        </span>
      );
    }
    const str = asText(val);
    if (isSensitive) {
      return <span>{maskValue(str)}</span>;
    }
    return <span>{str}</span>;
  };

  return (
    <div className="w-full flex justify-center py-4 bg-slate-200/60 rounded-xl overflow-x-auto print:bg-white print:p-0">
      {/* Standard A4 sheet: approx 210mm x 297mm; at 96 DPI: 794px width */}
      <div
        id="document-preview-sheet"
        className="w-[794px] min-h-[1123px] bg-white p-12 shadow-md border border-slate-300 font-serif text-[13.5px] leading-relaxed text-slate-900 flex flex-col justify-between print:shadow-none print:border-none print:w-full print:p-8"
        style={{ fontFamily: "'Merriweather', 'Times New Roman', Georgia, serif" }}
      >
        <div>
          {/* Letterhead Header */}
          <div className="border-b-2 border-[#1F3A5F] pb-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="relative w-16 h-16 shrink-0">
                <Image src={club.branding.logoLeft} alt="Club Logo" fill className="object-contain" />
              </div>
              <div className="text-center flex-1">
                <h1 className="text-xl font-bold tracking-tight text-[#4F81BD] uppercase">
                  {club.branding.letterheadTitle}
                </h1>
                <p className="text-[12px] font-semibold tracking-wide text-[#1F3A5F] mt-1">
                  {club.branding.letterheadSubtitle}
                </p>
                <p className="text-[11px] text-slate-500 italic mt-0.5">
                  Department of {club.department}
                </p>
              </div>
              <div className="relative w-16 h-16 shrink-0">
                <Image src={club.branding.logoRight} alt="Institute Logo" fill className="object-contain" />
              </div>
            </div>
          </div>

          {/* Template 1: Room Permission Letter */}
          {templateId === "room-permission" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-semibold">
                <div>
                  REF NO.:{" "}
                  <span className="font-mono font-bold text-slate-800">
                    {renderValue("ref_no", "[REF NO. TO BE FILLED]", false)}
                  </span>
                </div>
                <div>
                  DATE:{" "}
                  <span className="font-mono">
                    {values.letter_date ? formatDate(asText(values.letter_date)) : renderValue("letter_date", "[DATE]")}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-xs">
                <p className="font-bold">SUBMITTED TO:</p>
                <p>{renderValue("submitted_to", "HoD (CSE Dept.)")}</p>
              </div>

              <div className="text-xs pt-1">
                <p className="font-bold inline">SUBJECT: </p>
                <span className="italic font-medium">
                  {renderValue(
                    "subject",
                    `Requesting Permission to Conduct ${asText(values.event_title) || "the event"} in ${asText(values.venue) || "Seminar Hall"}.`
                  )}
                </span>
              </div>

              <div className="pt-2">
                <p className="font-bold text-xs uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
                  Schedule of Event:
                </p>
                {asRows(values.schedule).length > 0 ? (
                  <table className="w-full border-collapse border border-slate-300 text-xs text-left mb-3">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300 font-bold">Date</th>
                        <th className="p-2 border-r border-slate-300 font-bold">Time</th>
                        <th className="p-2 font-bold">Session / Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asRows(values.schedule).map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="p-2 border-r border-slate-300">{row.date || "-"}</td>
                          <td className="p-2 border-r border-slate-300">{row.time || "-"}</td>
                          <td className="p-2">{row.session || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-xs italic text-slate-500 mb-3">
                    Dates: {formatDateRange(asText(values.start_date), asText(values.end_date))} | Time: {formatTime(asText(values.start_time))} – {formatTime(asText(values.end_time))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <p className="font-bold text-xs uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
                  About the Event
                </p>
                <table className="w-full border-collapse border border-slate-300 text-xs text-left">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="p-2.5 font-bold bg-slate-50 w-44 border-r border-slate-300 align-top">
                        Brief Description
                      </td>
                      <td className="p-2.5 text-justify leading-relaxed">
                        {renderValue("description")}
                        <p className="mt-2 text-slate-600">
                          We request permission to use {renderValue("venue", "Seminar Hall")} on{" "}
                          {formatDateRange(asText(values.start_date), asText(values.end_date)) || renderValue("start_date")}{" "}
                          from {formatTime(asText(values.start_time)) || "09:00 AM"} to {formatTime(asText(values.end_time)) || "05:00 PM"} for conducting the event.
                        </p>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-2.5 font-bold bg-slate-50 border-r border-slate-300 align-top">
                        Objective
                      </td>
                      <td className="p-2.5 text-justify leading-relaxed">
                        {renderValue("objective")}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-2.5 font-bold bg-slate-50 border-r border-slate-300">
                        Number of Participants
                      </td>
                      <td className="p-2.5">{renderValue("participants", "100+")}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-2.5 font-bold bg-slate-50 border-r border-slate-300">
                        Mode
                      </td>
                      <td className="p-2.5">{renderValue("mode", "Offline")}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold bg-slate-50 border-r border-slate-300">
                        Event Organizers
                      </td>
                      <td className="p-2.5">{renderValue("organizers", `${club.shortName} Core ${club.academicYear}`)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 4 Contact blocks */}
              <div className="pt-4">
                <p className="font-bold text-xs uppercase tracking-wide border-b border-slate-300 pb-1 mb-3">
                  Contact Persons & Signatories:
                </p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {asRows(values.contacts).length > 0 ? (
                    asRows(values.contacts).map((c, idx) => (
                      <div key={idx} className="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                        <p className="font-bold text-slate-800">{c.name || <span className="bg-yellow-200 px-1">[Name]</span>}</p>
                        <p className="text-slate-600">{c.designation || "-"}</p>
                        {c.admission_no && <p className="text-slate-500">Adm No: {c.admission_no}</p>}
                        {c.branch && <p className="text-slate-500">Branch: {c.branch}</p>}
                        <p className="text-slate-700 font-mono mt-1">
                          Mob: {c.mobile ? maskValue(c.mobile, 3) : <span className="bg-yellow-100 text-yellow-800 px-1 text-[11px]">[Not provided]</span>}
                        </p>
                      </div>
                    ))
                  ) : (
                    club.signatories.map((sig, idx) => (
                      <div key={idx} className="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                        <p className="font-bold text-slate-800">{sig.name}</p>
                        <p className="text-slate-600">{sig.designation}</p>
                        <p className="text-slate-500">Branch: Computer Science & Engineering</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Template 2: Bill Certificate (Form BC-R) */}
          {templateId === "bill-certificate" && (
            <div className="space-y-3.5 text-xs">
              <div className="text-center pb-2 border-b border-slate-300">
                <p className="font-bold text-sm tracking-wide text-[#1F3A5F]">DEAN STUDENT WELFARE</p>
                <p className="font-bold text-base mt-0.5">FORM BC-R</p>
                <p className="font-semibold text-xs tracking-wider text-slate-700">
                  BILL CERTIFICATE (RECURRING EXPENDITURE)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="font-bold">Chapter Name: </span>
                  {renderValue("chapter_name", club.shortName)}
                </div>
                <div>
                  <span className="font-bold">Code No.: </span>
                  {renderValue("head_of_account", "6/52")}
                </div>
                <div>
                  <span className="font-bold">Approval Note No.: </span>
                  {renderValue("approval_note_no")}
                </div>
                <div>
                  <span className="font-bold">Date: </span>
                  {values.approval_date ? formatDateSlash(asText(values.approval_date)) : renderValue("approval_date")}
                </div>
                <div>
                  <span className="font-bold">Purchase Order No. & Date: </span>
                  {renderValue("purchase_order", "NiL")}
                </div>
                <div>
                  <span className="font-bold">Advance drawn (Rs.): </span>
                  {renderValue("advance_drawn", "NiL")}
                </div>
              </div>

              <div className="p-2 bg-slate-50 border border-slate-300 italic text-[11.5px] leading-relaxed my-2">
                &ldquo;I, am <span className="font-semibold">{renderValue("certifying_person", "Dr. Sankita J. Patel")}</span>,
                personally satisfied that the goods (described below) purchased are of the requisite quality and
                specification and have been purchased from a reliable supplier / contractor at a reasonable price.&rdquo;
              </div>

              {/* Items Table */}
              <div className="pt-1">
                <table className="w-full border-collapse border border-slate-400 text-xs text-left">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-400 text-center font-bold">
                      <th className="p-1.5 border-r border-slate-400 w-12">Sr. No.</th>
                      <th className="p-1.5 border-r border-slate-400 text-left">Name of Equipment / Item(s)</th>
                      <th className="p-1.5 border-r border-slate-400 w-16">Qty</th>
                      <th className="p-1.5 border-r border-slate-400 w-24">Unit Cost (Rs.)</th>
                      <th className="p-1.5 w-28">Total Cost (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asRows(values.items).length > 0 ? (
                      asRows(values.items).map((it, idx) => (
                        <tr key={idx} className="border-b border-slate-300">
                          <td className="p-1.5 border-r border-slate-400 text-center">{idx + 1}</td>
                          <td className="p-1.5 border-r border-slate-400">{it.name || "-"}</td>
                          <td className="p-1.5 border-r border-slate-400 text-center">{it.qty || "1"}</td>
                          <td className="p-1.5 border-r border-slate-400 text-right">{it.unit_cost || "0"}</td>
                          <td className="p-1.5 text-right font-medium">{it.total || "0"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-3 text-center italic text-yellow-800 bg-yellow-50">
                          [No items added - click &ldquo;Add row&rdquo; in the editor]
                        </td>
                      </tr>
                    )}
                    <tr className="font-semibold bg-slate-50 border-t border-slate-400">
                      <td colSpan={4} className="p-1.5 border-r border-slate-400 text-right">
                        Total Amount (Rs.)
                      </td>
                      <td className="p-1.5 text-right">{formatCurrency(sumColumn(asRows(values.items), "total"))}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="p-1.5 border-r border-slate-400 text-right">
                        + Taxes or other charges
                      </td>
                      <td className="p-1.5 text-right">{renderValue("taxes", "0")}</td>
                    </tr>
                    <tr className="font-bold bg-slate-100 border-t border-slate-400 text-slate-900">
                      <td colSpan={4} className="p-1.5 border-r border-slate-400 text-right">
                        Total Estimated Amount Including Taxes (Rs.)
                      </td>
                      <td className="p-1.5 text-right">
                        {formatCurrency(sumColumn(asRows(values.items), "total") + (parseFloat(asText(values.taxes)) || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Supplier & Payment Details */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="border border-slate-300 p-2.5 rounded">
                  <p className="font-bold border-b border-slate-200 pb-1 mb-1.5 text-[#1F3A5F]">SUPPLIER DETAILS</p>
                  <p><span className="font-semibold">Name:</span> {renderValue("supplier_name")}</p>
                  <p><span className="font-semibold">GST No.:</span> {renderValue("supplier_gst", "[GST NOT PROVIDED]", true)}</p>
                  <p><span className="font-semibold">Invoice No.:</span> {renderValue("invoice_no")}</p>
                  <p><span className="font-semibold">Invoice Date:</span> {values.invoice_date ? formatDateSlash(asText(values.invoice_date)) : renderValue("invoice_date")}</p>
                </div>

                <div className="border border-slate-300 p-2.5 rounded">
                  <p className="font-bold border-b border-slate-200 pb-1 mb-1.5 text-[#1F3A5F]">PAYMENT DETAILS</p>
                  <p><span className="font-semibold">Party / Payee:</span> {renderValue("payee_name")}</p>
                  <p><span className="font-semibold">Account No.:</span> {renderValue("account_number", "[A/C NOT PROVIDED]", true)}</p>
                  <p><span className="font-semibold">Account Holder:</span> {renderValue("account_holder")}</p>
                  <p><span className="font-semibold">Bank & Branch:</span> {renderValue("bank_name")} ({renderValue("bank_branch", "Main Branch")})</p>
                  <p><span className="font-semibold">IFSC Code:</span> {renderValue("ifsc", "[IFSC NOT PROVIDED]", true)}</p>
                </div>
              </div>

              {/* Indenter & Signatures */}
              <div className="pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
                <div>
                  <p className="font-bold">INDENTER DETAILS</p>
                  <p className="mt-1 font-semibold">{renderValue("indenter_name", "Dr. Sankita J. Patel")}</p>
                  <p className="text-slate-600">{renderValue("indenter_designation", "Assistant Professor")}</p>
                  <p className="text-slate-600">Department: {renderValue("indenter_department", "CSE")}</p>
                  <div className="mt-6 border-t border-dashed border-slate-400 pt-1 text-[11px] text-slate-500">
                    Signature with Date
                  </div>
                </div>
                <div className="text-right flex flex-col justify-end">
                  <p className="font-semibold">Dean Student Welfare</p>
                  <p className="text-slate-500 text-[11px] mt-8">Recommended & Approved for Payment</p>
                </div>
              </div>
            </div>
          )}

          {/* Template 3: Bill Summary */}
          {templateId === "bill-summary" && (
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#1F3A5F] text-sm">BILL SUMMARY</span>
                <span>DATE: {values.summary_date ? formatDate(asText(values.summary_date)) : renderValue("summary_date")}</span>
              </div>

              <p className="text-sm font-semibold border-b border-slate-300 pb-1">
                Reimbursement for Cost Incurred in:{" "}
                <span className="text-[#4F81BD]">{renderValue("event_title", "the event")}</span>
              </p>

              {/* Reimbursements Table */}
              <table className="w-full border-collapse border border-slate-300 text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-center font-bold">
                    <th className="p-2 border-r border-slate-300 w-12">Sr. No.</th>
                    <th className="p-2 border-r border-slate-300 text-left">Name / Team</th>
                    <th className="p-2 border-r border-slate-300 text-left">Account Details</th>
                    <th className="p-2 border-r border-slate-300 text-left">To Be Paid To</th>
                    <th className="p-2 text-right w-28">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {asRows(values.reimbursements).length > 0 ? (
                    asRows(values.reimbursements).map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 border-r border-slate-300 text-center">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-300 font-medium">{row.name || "-"}</td>
                        <td className="p-2 border-r border-slate-300 font-mono text-[11px]">
                          {row.account ? maskValue(row.account, 4) : <span className="text-yellow-700 bg-yellow-100 px-1">[Not provided]</span>}
                        </td>
                        <td className="p-2 border-r border-slate-300">{row.paid_to || "-"}</td>
                        <td className="p-2 text-right font-medium">{row.amount || "0"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-3 text-center italic text-yellow-800 bg-yellow-50">
                        [No reimbursements added - add entries in the editor]
                      </td>
                    </tr>
                  )}
                  <tr className="font-bold bg-slate-100 border-t border-slate-300">
                    <td colSpan={4} className="p-2 border-r border-slate-300 text-right">Grand Total</td>
                    <td className="p-2 text-right">{formatCurrency(sumColumn(asRows(values.reimbursements), "amount"))}</td>
                  </tr>
                </tbody>
              </table>

              <p className="text-xs italic text-slate-600">
                Amount in words: {amountInWords(sumColumn(asRows(values.reimbursements), "amount"))}
              </p>

              {/* Other Bank Accounts Table */}
              {asRows(values.other_accounts).length > 0 && (
                <div className="pt-2">
                  <p className="font-bold text-xs mb-1.5">Other Bank Account Details:</p>
                  <table className="w-full border-collapse border border-slate-300 text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300 font-bold">
                        <th className="p-1.5 border-r border-slate-300 w-12">Sr. No.</th>
                        <th className="p-1.5 border-r border-slate-300">Name</th>
                        <th className="p-1.5 border-r border-slate-300">Account No.</th>
                        <th className="p-1.5 border-r border-slate-300">IFSC Code</th>
                        <th className="p-1.5 text-right w-24">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asRows(values.other_accounts).map((acc, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="p-1.5 border-r border-slate-300 text-center">{idx + 1}</td>
                          <td className="p-1.5 border-r border-slate-300">{acc.name || "-"}</td>
                          <td className="p-1.5 border-r border-slate-300 font-mono text-[11px]">{maskValue(acc.account_no || "")}</td>
                          <td className="p-1.5 border-r border-slate-300 font-mono text-[11px]">{maskValue(acc.ifsc || "")}</td>
                          <td className="p-1.5 text-right">{acc.amount || "0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3 Signatories column */}
              <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">Student Head</div>
                  <p className="mt-0.5">{club.signatories[0]?.name || "Ansh Gupta"}</p>
                  <p className="text-[11px] text-slate-500">ACM NIT-Surat</p>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">Student Secretary</div>
                  <p className="mt-0.5">{club.signatories[1]?.name || "Arshad Khatib"}</p>
                  <p className="text-[11px] text-slate-500">ACM NIT-Surat</p>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">Faculty Chairman</div>
                  <p className="mt-0.5">{club.signatories[2]?.name || "Dr. Sankita Patel"}</p>
                  <p className="text-[11px] text-slate-500">ACM NIT-Surat</p>
                </div>
              </div>
            </div>
          )}

          {/* Fallback Generic Preview for custom templates */}
          {!["room-permission", "bill-certificate", "bill-summary"].includes(templateId) && (
            <div className="space-y-4 text-xs">
              <h2 className="text-base font-bold text-center border-b border-slate-300 pb-2">
                {renderValue("event_title", "Document Preview")}
              </h2>
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <tbody>
                  {Object.entries(values).map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-200">
                      <td className="p-2 font-bold bg-slate-50 w-48 border-r border-slate-300">{k}</td>
                      <td className="p-2">{isEmptyValue(v) ? renderValue(k) : asText(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-8 mt-auto border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
          <span>{club.name}</span>
          <span>Official Document · ClubDocs</span>
        </div>
      </div>
    </div>
  );
}
