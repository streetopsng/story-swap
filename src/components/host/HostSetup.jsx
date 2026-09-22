import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../common/Navbar';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Toast from '../common/Toast';
import { CATEGORIES } from '../../utils/questionBank';
import { createSession } from '../../firebase/sessionService';
import { sendBulkSessionInvitations, isBrevoConfigured } from '../../services/emailService';

export default function HostSetup() {
  const navigate = useNavigate();

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const [sessionName, setSessionName] = useState(`Team Bonding — ${currentMonth}`);
  const [roundCount, setRoundCount] = useState(3);
  const [toastMsg, setToastMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoEmailInvites, setAutoEmailInvites] = useState(isBrevoConfigured);

  // Real teammate list (initialized empty - no mock data)
  const [teammates, setTeammates] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');

  // Bulk email paste modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Custom question modal
  const [isCustomQModalOpen, setIsCustomQModalOpen] = useState(false);
  const [cqSelectedCat, setCqSelectedCat] = useState('How You Work');
  const [cqPrompt, setCqPrompt] = useState('');
  const [customQuestions, setCustomQuestions] = useState({});

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleToggleTeammate = (index) => {
    setTeammates((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleRemoveTeammate = (index, e) => {
    e.stopPropagation();
    setTeammates((prev) => prev.filter((_, i) => i !== index));
    showToast('Teammate removed');
  };

  const handleToggleAll = () => {
    if (teammates.length === 0) return;
    const allSelected = teammates.every((t) => t.selected);
    setTeammates((prev) => prev.map((t) => ({ ...t, selected: !allSelected })));
  };

  const defaultAvatars = ['🦊', '🐻', '🐯', '🦁', '🐺', '🦅', '🐬', '🦋', '🐸', '🦄'];

  const handleAddTeammate = (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      showToast('Enter a valid email address');
      return;
    }
    const emailNorm = newEmail.trim().toLowerCase();
    if (teammates.some((t) => t.email.toLowerCase() === emailNorm)) {
      showToast('This teammate is already in the list');
      return;
    }

    const randomAv = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
    setTeammates((prev) => [
      ...prev,
      {
        id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: newName.trim() || emailNorm.split('@')[0],
        email: emailNorm,
        dept: 'Team',
        av: randomAv,
        selected: true,
      },
    ]);
    setNewEmail('');
    setNewName('');
    showToast('Teammate added');
  };

  const handleProcessBulkEmails = () => {
    if (!bulkText.trim()) {
      showToast('Paste some emails first');
      return;
    }

    // Split by commas, semicolons, spaces, or newlines
    const rawTokens = bulkText.split(/[\s,;]+/);
    const validEmails = rawTokens
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.includes('@') && t.includes('.'));

    if (validEmails.length === 0) {
      showToast('No valid email addresses found');
      return;
    }

    let addedCount = 0;
    setTeammates((prev) => {
      const existing = new Set(prev.map((t) => t.email.toLowerCase()));
      const newItems = [];
      validEmails.forEach((email) => {
        if (!existing.has(email)) {
          existing.add(email);
          addedCount++;
          const randomAv = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
          newItems.push({
            id: `bulk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: email.split('@')[0],
            email,
            dept: 'Team',
            av: randomAv,
            selected: true,
          });
        }
      });
      return [...prev, ...newItems];
    });

    setBulkText('');
    setIsBulkModalOpen(false);
    showToast(`Added ${addedCount} new teammate${addedCount === 1 ? '' : 's'}`);
  };

  const handleSaveCustomQuestion = () => {
    const text = cqPrompt.trim();
    if (!text) {
      showToast('Write a prompt first');
      return;
    }

    setCustomQuestions((prev) => ({
      ...prev,
      [cqSelectedCat]: [...(prev[cqSelectedCat] || []), text],
    }));

    showToast(`Added to ${cqSelectedCat}`);
    setCqPrompt('');
    setIsCustomQModalOpen(false);
  };

  const handleLaunch = async () => {
    const selectedTeammates = teammates.filter((t) => t.selected);

    setIsSubmitting(true);
    try {
      const sessionId = await createSession({
        name: sessionName.trim() || 'Team Bonding',
        roundCount,
        invitedEmails: selectedTeammates,
        customQuestions,
      });

      if (autoEmailInvites && isBrevoConfigured && selectedTeammates.length > 0) {
        // Send email invitations via Brevo in background
        sendBulkSessionInvitations({
          recipients: selectedTeammates,
          sessionName: sessionName.trim() || 'Team Bonding',
          sessionId,
        }).catch((err) => {
          console.error('Failed to send email invites:', err);
        });

        showToast(`Session created! Emailed invites to ${selectedTeammates.length} teammate${selectedTeammates.length === 1 ? '' : 's'}.`);
      } else if (selectedTeammates.length > 0) {
        showToast(`Session created for ${selectedTeammates.length} teammate${selectedTeammates.length === 1 ? '' : 's'}`);
      } else {
        showToast('Session created! Copy the invite link to invite teammates.');
      }
      navigate(`/host/${sessionId}/lobby`);
    } catch (err) {
      console.error('Failed to create session:', err);
      showToast('Failed to create session. Please try again.');
      setIsSubmitting(false);
    }
  };

  const selectedCount = teammates.filter((t) => t.selected).length;
  const customQCount = Object.values(customQuestions).reduce((sum, list) => sum + list.length, 0);

  return (
    <main className="flex flex-col min-h-screen w-full mx-auto bg-[#EDEAE4] overflow-x-hidden">
      <Navbar contextText="Story Swap" showBack maxWidthClass="max-w-[430px] md:max-w-5xl" />

      <Toast message={toastMsg} />

      {/* Main Container: Mobile = max-w-[430px]; Desktop = max-w-5xl */}
      <div className="flex-1 w-full max-w-[430px] md:max-w-5xl mx-auto px-4 md:px-6 py-2 md:py-6">
        
        <div className="md:grid md:grid-cols-12 md:gap-6 space-y-4 md:space-y-0">
          
          {/* Left Column (Session Config) */}
          <div className="md:col-span-7 space-y-4">
            
            {/* Session Name Card */}
            <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-[0_2px_0_#E0DBD4]">
              <label htmlFor="session-name-input" className="block text-[11px] font-extrabold tracking-wider uppercase text-[#555555] mb-2">
                Session name
              </label>
              <Input
                id="session-name-input"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g. Engineering & Design Sync"
                maxLength={45}
                className="text-base"
              />
            </section>

            {/* Rounds Card */}
            <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-[0_2px_0_#E0DBD4]">
              <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#555555] mb-1">
                Rounds
              </div>
              <p className="text-[12px] text-[#999999] mb-3.5">
                Each round, Story Swap assigns a fresh prompt and forms new small groups of 2–3.
              </p>
              <div className="grid grid-cols-4 gap-2.5">
                {[2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setRoundCount(count)}
                    className={`py-3.5 px-1 text-center rounded-[16px] border-2 font-extrabold text-[13px] md:text-[14px] cursor-pointer transition-all duration-150 ${
                      roundCount === count
                        ? 'border-[#F5821F] bg-[#FDE8D0] text-[#E8710A]'
                        : 'border-[#E0DBD4] bg-white text-[#1A1A1A] hover:bg-neutral-50'
                    }`}
                  >
                    {count} rounds
                  </button>
                ))}
              </div>

              {/* Custom Questions Section */}
              <div className="mt-4 pt-4 border-t border-[#E0DBD4] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#1A1A1A]">
                    Custom Prompts {customQCount > 0 && <span className="text-[#F5821F]">({customQCount} added)</span>}
                  </div>
                  <div className="text-[11px] text-[#999999]">
                    Include questions specific to your company or project
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomQModalOpen(true)}
                  className="text-[12px] font-bold text-[#F5821F] hover:text-[#E8710A] underline cursor-pointer"
                >
                  + Add prompt
                </button>
              </div>
            </section>

            {/* Desktop Explainer Card */}
            <section className="hidden md:block bg-[#FAF7F2] border border-[#E0DBD4] rounded-[20px] p-5">
              <div className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider mb-2">
                How it works for teammates
              </div>
              <ol className="text-xs text-[#555555] space-y-2 list-decimal list-inside">
                <li>You launch the session and receive an instant direct invite link and code.</li>
                <li>Teammates join on their phone or browser without logging into accounts.</li>
                <li>Story Swap shuffles groups each round so teammates converse with someone new.</li>
              </ol>
            </section>
          </div>

          {/* Right Column (Team Picker & Launch) */}
          <div className="md:col-span-5 space-y-4">
            
            {/* Teammates Picker Card */}
            <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-[0_2px_0_#E0DBD4]">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#555555]">
                  Teammates · <span className="text-[#F5821F]">{selectedCount} selected</span>
                </div>
                {teammates.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleAll}
                    className="text-[11px] font-bold text-[#F5821F] underline cursor-pointer"
                  >
                    {teammates.every((t) => t.selected) ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              <p className="text-[12px] text-[#999999] mb-3">
                Pre-invite teammates by email, or skip and share the link directly in lobby.
              </p>

              {/* Teammate List */}
              <div className="divide-y divide-[#E0DBD4] max-h-56 md:max-h-64 overflow-y-auto no-scrollbar">
                {teammates.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#999999] bg-[#FAF7F2] rounded-xl border border-dashed border-[#E0DBD4] px-4">
                    <span className="text-2xl block mb-1">👥</span>
                    No teammates added yet.<br />
                    Add teammates below, paste a batch of emails, or simply launch and share the invite link!
                  </div>
                ) : (
                  teammates.map((teammate, index) => (
                    <div
                      key={teammate.id}
                      onClick={() => handleToggleTeammate(index)}
                      className={`flex items-center gap-2.5 py-2.5 px-1 cursor-pointer select-none transition-opacity ${
                        teammate.selected ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center shrink-0 text-xs font-black text-white ${
                          teammate.selected
                            ? 'bg-[#F5821F] border-[#F5821F]'
                            : 'border-[#E0DBD4] bg-white'
                        }`}
                      >
                        {teammate.selected && '✓'}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#FDE8D0] border-[1.5px] border-[#F5821F] flex items-center justify-center text-sm shrink-0">
                        {teammate.av}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#1A1A1A] truncate">
                          {teammate.name}
                        </div>
                        <div className="text-[11px] text-[#999999] truncate">
                          {teammate.email}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveTeammate(index, e)}
                        className="text-xs text-[#999999] hover:text-[#E8334A] px-1.5 py-1 rounded cursor-pointer"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Teammate Input Bar */}
              <form onSubmit={handleAddTeammate} className="mt-3.5 pt-3.5 border-t border-[#E0DBD4] space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Name (optional)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-xs py-2 px-3 w-1/3"
                  />
                  <Input
                    placeholder="teammate@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    type="email"
                    className="text-xs py-2 px-3 flex-1"
                  />
                  <Button
                    type="submit"
                    variant="dark"
                    className="w-auto px-4 py-2 text-xs"
                  >
                    + Add
                  </Button>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(true)}
                    className="text-xs font-bold text-[#F5821F] hover:text-[#E8710A] underline cursor-pointer flex items-center gap-1"
                  >
                    📋 Bulk paste emails
                  </button>
                </div>
              </form>
            </section>

            {/* Desktop Sticky Launch Card */}
            <section className="bg-white md:bg-[#FAF7F2] border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-[0_2px_0_#E0DBD4] space-y-3">
              <div className="flex items-center justify-between text-xs text-[#555555]">
                <span>Configured rounds:</span>
                <strong className="text-[#1A1A1A]">{roundCount} rounds</strong>
              </div>
              <div className="flex items-center justify-between text-xs text-[#555555]">
                <span>Invited teammates:</span>
                <strong className="text-[#1A1A1A]">{selectedCount} ready to invite</strong>
              </div>

              {isBrevoConfigured && selectedCount > 0 && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAF7F2] border border-[#E0DBD4] text-xs font-semibold text-[#1A1A1A] cursor-pointer hover:border-[#F5821F] transition-colors">
                  <input
                    type="checkbox"
                    checked={autoEmailInvites}
                    onChange={(e) => setAutoEmailInvites(e.target.checked)}
                    className="accent-[#F5821F] w-4 h-4 mt-0.5 rounded cursor-pointer shrink-0"
                  />
                  <span>
                    ✉️ Automatically email game link to invited teammates via Brevo
                  </span>
                </label>
              )}

              <Button
                variant="orange"
                onClick={handleLaunch}
                disabled={isSubmitting}
                className="py-4 text-base mt-2"
              >
                {isSubmitting ? 'Launching...' : 'Launch session — notify team ›'}
              </Button>
              <p className="text-[11px] text-[#999999] text-center leading-relaxed">
                You will land in the host lobby with a live invite link to share with your team.
              </p>
            </section>

          </div>
        </div>
      </div>

      {/* Bulk Paste Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Paste Teammate Emails"
      >
        <div className="space-y-3">
          <p className="text-xs text-[#555555]">
            Paste multiple emails separated by commas, spaces, or new lines. We'll automatically extract and add them to your roster.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="alice@company.com, bob@company.com&#10;carol@company.com"
            rows={5}
            className="w-full bg-white border-[1.5px] border-[#E0DBD4] rounded-[10px] text-[#1A1A1A] text-[13px] p-3 outline-none placeholder-[#bbb] focus:border-[#F5821F] font-mono"
          />
          <div className="flex gap-3 items-center pt-2">
            <Button
              variant="orange"
              onClick={handleProcessBulkEmails}
              className="flex-1"
            >
              Import emails
            </Button>
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              className="text-[13px] font-bold text-[#555555] underline cursor-pointer px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Custom Question Modal */}
      <Modal
        isOpen={isCustomQModalOpen}
        onClose={() => setIsCustomQModalOpen(false)}
        title="Add your own prompt"
      >
        <div className="space-y-3">
          <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#555555]">
            Category
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCqSelectedCat(cat)}
                className={`py-2 px-3.5 rounded-full border-2 text-[12px] font-bold cursor-pointer transition-all ${
                  cqSelectedCat === cat
                    ? 'border-[#F5821F] bg-[#FDE8D0] text-[#E8710A]'
                    : 'border-[#E0DBD4] bg-white text-[#1A1A1A]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#555555] pt-2">
            Prompt
          </div>
          <Input
            value={cqPrompt}
            onChange={(e) => setCqPrompt(e.target.value)}
            placeholder="e.g. What's a small thing that makes your day better?"
            maxLength={140}
          />

          <div className="flex gap-3 items-center pt-3">
            <Button
              variant="orange"
              onClick={handleSaveCustomQuestion}
              className="flex-1"
            >
              Save prompt
            </Button>
            <button
              type="button"
              onClick={() => setIsCustomQModalOpen(false)}
              className="text-[13px] font-bold text-[#555555] underline cursor-pointer px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
