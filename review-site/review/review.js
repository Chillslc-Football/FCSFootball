(function () {
  const cfg = window.FCS_PULSE_REVIEW || {};
  const apiBaseUrl = String(cfg.apiBaseUrl || '').replace(/\/$/, '');

  const els = {
    loading: document.getElementById('state-loading'),
    detail: document.getElementById('state-detail'),
    result: document.getElementById('state-result'),
    error: document.getElementById('state-error'),
    resultTitle: document.getElementById('result-title'),
    resultDetail: document.getElementById('result-detail'),
    errorDetail: document.getElementById('error-detail'),
    name: document.getElementById('field-name'),
    links: document.getElementById('field-links'),
    national: document.getElementById('field-national'),
    teams: document.getElementById('field-teams'),
    conferences: document.getElementById('field-conferences'),
    notes: document.getElementById('field-notes'),
    email: document.getElementById('field-email'),
    submitted: document.getElementById('field-submitted'),
    status: document.getElementById('field-status'),
    reviewed: document.getElementById('field-reviewed'),
    reviewedWrap: document.getElementById('reviewed-wrap'),
    actionsPending: document.getElementById('actions-pending'),
    confirmBox: document.getElementById('confirm-box'),
    confirmText: document.getElementById('confirm-text'),
    btnApprove: document.getElementById('btn-approve'),
    btnReject: document.getElementById('btn-reject'),
    btnReply: document.getElementById('btn-reply'),
    btnConfirm: document.getElementById('btn-confirm'),
    btnCancel: document.getElementById('btn-cancel'),
  };

  let token = '';
  let pendingAction = null;
  let suggestion = null;

  function show(id) {
    for (const key of ['loading', 'detail', 'result', 'error']) {
      els[key].classList.toggle('hidden', key !== id);
    }
  }

  function formatWhen(iso) {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return (
      date.toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }) + ' (UTC)'
    );
  }

  function buildMailto(email, creatorName) {
    const subject = 'Question about your FCS Pulse media suggestion';
    const body = [
      'Hi,',
      '',
      `Thanks for suggesting ${creatorName} for FCS Pulse.`,
      '',
      'I have a quick question:',
      '',
    ].join('\n');
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function renderLinks(platformLinks) {
    const entries = Object.entries(platformLinks || {}).filter(([, url]) => Boolean(url));
    if (!entries.length) {
      els.links.textContent = 'None';
      return;
    }
    els.links.innerHTML = '';
    for (const [key, url] of entries) {
      const row = document.createElement('div');
      const label = document.createElement('strong');
      label.textContent = `${key}: `;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = url;
      row.appendChild(label);
      row.appendChild(anchor);
      els.links.appendChild(row);
    }
  }

  function renderSuggestion(data) {
    suggestion = data;
    els.name.textContent = data.name || 'Untitled';
    renderLinks(data.platformLinks);
    els.national.textContent = data.isNational ? 'Yes' : 'No';
    els.teams.textContent = (data.teams && data.teams.length ? data.teams.join(', ') : 'None');
    els.conferences.textContent =
      data.conferences && data.conferences.length ? data.conferences.join(', ') : 'None';
    els.notes.textContent = data.notes && String(data.notes).trim() ? data.notes : 'None';
    els.email.textContent = data.submitterEmail || 'None';
    els.submitted.textContent = formatWhen(data.submittedAt);
    els.status.textContent = data.status || 'unknown';

    if (data.reviewedAt) {
      els.reviewedWrap.classList.remove('hidden');
      els.reviewed.textContent = formatWhen(data.reviewedAt);
    } else {
      els.reviewedWrap.classList.add('hidden');
    }

    const pending = data.status === 'pending';
    els.actionsPending.classList.toggle('hidden', !pending);
    els.confirmBox.classList.add('hidden');
    pendingAction = null;

    if (data.submitterEmail) {
      els.btnReply.href = buildMailto(data.submitterEmail, data.name || 'your suggestion');
      els.btnReply.classList.remove('hidden');
    } else {
      els.btnReply.classList.add('hidden');
    }

    show('detail');

    if (!pending) {
      // Already reviewed — keep detail visible with status.
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const hinted = params.get('action');
    if (hinted === 'approve' || hinted === 'reject') {
      openConfirm(hinted);
    }
  }

  function openConfirm(action) {
    pendingAction = action;
    els.confirmText.textContent =
      action === 'approve'
        ? 'Confirm that you want to approve this suggestion.'
        : 'Confirm that you want to reject this suggestion.';
    els.confirmBox.classList.remove('hidden');
    els.btnConfirm.textContent = action === 'approve' ? 'Confirm Approve' : 'Confirm Reject';
  }

  async function loadSuggestion() {
    show('loading');
    if (!apiBaseUrl || apiBaseUrl.includes('YOUR_PROJECT_REF')) {
      els.errorDetail.textContent =
        'Review API is not configured. Set apiBaseUrl in review/config.js.';
      show('error');
      return;
    }
    if (!token) {
      els.errorDetail.textContent = 'This review link is invalid.';
      show('error');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json();
      if (!payload || !payload.ok) {
        els.errorDetail.textContent =
          (payload && payload.message) || 'This review link is invalid or expired.';
        show('error');
        return;
      }
      renderSuggestion(payload.suggestion);
    } catch {
      els.errorDetail.textContent = 'Unable to load this suggestion right now.';
      show('error');
    }
  }

  async function submitAction(action) {
    els.btnConfirm.disabled = true;
    els.btnApprove.disabled = true;
    els.btnReject.disabled = true;
    try {
      const response = await fetch(apiBaseUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, action }),
      });
      const payload = await response.json();
      if (!payload || !payload.ok) {
        if (payload && payload.error === 'already_reviewed') {
          els.resultTitle.textContent = 'Already reviewed';
          els.resultDetail.textContent = 'This suggestion was already reviewed.';
          show('result');
          return;
        }
        els.errorDetail.textContent =
          (payload && payload.message) || 'This review link is invalid or expired.';
        show('error');
        return;
      }

      if (payload.status === 'approved') {
        els.resultTitle.textContent = 'Suggestion Approved';
        els.resultDetail.textContent = payload.submitterNotified
          ? 'The submitter has been notified.'
          : 'The suggestion was approved.';
      } else {
        els.resultTitle.textContent = 'Suggestion Rejected';
        els.resultDetail.textContent = payload.submitterNotified
          ? 'The submitter has been notified.'
          : 'The suggestion was rejected.';
      }
      show('result');
    } catch {
      els.errorDetail.textContent = 'Unable to complete this review right now.';
      show('error');
    } finally {
      els.btnConfirm.disabled = false;
      els.btnApprove.disabled = false;
      els.btnReject.disabled = false;
    }
  }

  els.btnApprove.addEventListener('click', () => openConfirm('approve'));
  els.btnReject.addEventListener('click', () => openConfirm('reject'));
  els.btnCancel.addEventListener('click', () => {
    pendingAction = null;
    els.confirmBox.classList.add('hidden');
  });
  els.btnConfirm.addEventListener('click', () => {
    if (pendingAction === 'approve' || pendingAction === 'reject') {
      void submitAction(pendingAction);
    }
  });

  const params = new URLSearchParams(window.location.search);
  token = params.get('token') || '';
  void loadSuggestion();
})();
