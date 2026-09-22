import React, { useEffect, useState } from 'react';
import {
  CommercialConfig,
  SubscriptionCode,
  SupportTicket,
  PromotedApp,
} from '../types';
import { dbAll, dbPut, dbDel, STORES } from '../lib/db';
import {
  makeSubscriptionCode,
  num,
  esc,
  nowISO,
  todayISO,
  OWNER_PASSWORD,
} from '../lib/utils';

interface OwnerPanelViewProps {
  config: CommercialConfig;
  onSaveConfig: (cfg: CommercialConfig) => void;
  onLogout: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onRefreshData: () => void;
}

export const OwnerPanelView: React.FC<OwnerPanelViewProps> = ({
  config,
  onSaveConfig,
  onLogout,
  onShowToast,
  onRefreshData,
}) => {
  const [codes, setCodes] = useState<SubscriptionCode[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [promotions, setPromotions] = useState<PromotedApp[]>([]);

  // Code Gen form
  const [codePlan, setCodePlan] = useState<'monthly' | 'yearly' | 'lifetime' | 'trial'>('monthly');
  const [codeCount, setCodeCount] = useState(1);
  const [codeExpiry, setCodeExpiry] = useState('');
  const [codeNote, setCodeNote] = useState('');

  // Identity Form
  const [appName, setAppName] = useState(config.name);
  const [ownerName, setOwnerName] = useState(config.owner);
  const [supportPhone, setSupportPhone] = useState(config.support);
  const [whatsappPhone, setWhatsappPhone] = useState(config.whatsapp);
  const [vodafonePhone, setVodafonePhone] = useState(config.vodafoneCash);
  const [monthlyPrice, setMonthlyPrice] = useState(config.plans.monthly);
  const [yearlyPrice, setYearlyPrice] = useState(config.plans.yearly);
  const [lifetimePrice, setLifetimePrice] = useState(config.plans.lifetime);

  // Sections toggle
  const [sectionsState, setSectionsState] = useState<Record<string, boolean>>(
    config.sections || {}
  );

  // Promotion Form Modal
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoId, setPromoId] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoUrl, setPromoUrl] = useState('');
  const [promoKind, setPromoKind] = useState('موصى به');
  const [promoAffiliate, setPromoAffiliate] = useState(false);
  const [promoActive, setPromoActive] = useState(true);

  // Ticket reply modal
  const [replyTicket, setReplyTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');

  const loadOwnerData = async () => {
    try {
      const codeList = await dbAll<SubscriptionCode>('codes');
      const ticketList = await dbAll<SupportTicket>('tickets');
      setCodes(codeList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setTickets(ticketList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

      const savedPromos = localStorage.getItem('plm_promotions');
      if (savedPromos) {
        setPromotions(JSON.parse(savedPromos));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadOwnerData();
  }, []);

  const handleGenerateCodes = async () => {
    const count = Math.max(1, Math.min(100, Number(codeCount) || 1));
    const newCodes: SubscriptionCode[] = [];

    for (let i = 0; i < count; i++) {
      const item: SubscriptionCode = {
        id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        code: makeSubscriptionCode(),
        plan: codePlan,
        createdAt: nowISO(),
        expiresAt: codeExpiry || null,
        status: 'unused',
        note: codeNote.trim(),
      };
      await dbPut('codes', item);
      newCodes.push(item);
    }

    onShowToast(`تم إنشاء ${count} كود اشتراك بنجاح!`, 'success');
    setCodeNote('');
    loadOwnerData();
  };

  const handleToggleCodeStatus = async (item: SubscriptionCode) => {
    const newStatus = item.status === 'disabled' ? 'unused' : 'disabled';
    const updated = { ...item, status: newStatus as any };
    await dbPut('codes', updated);
    onShowToast(`تم تحديث حالة الكود إلى ${newStatus}`, 'info');
    loadOwnerData();
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('حذف كود الاشتراك نهائياً؟')) return;
    await dbDel('codes', id);
    onShowToast('تم حذف الكود بنجاح', 'success');
    loadOwnerData();
  };

  const handleCopyUnusedCodes = () => {
    const unusedList = codes.filter((c) => c.status === 'unused');
    if (!unusedList.length) {
      return onShowToast('لا توجد أكواد غير مستخدمة للنسخ', 'warning');
    }
    const text = unusedList
      .map((c) => `${c.code} | الخطة: ${c.plan} | الانتهاء: ${c.expiresAt || 'بدون'}`)
      .join('\n');
    navigator.clipboard
      ?.writeText(text)
      .then(() => onShowToast(`تم نسخ ${unusedList.length} كود غير مستخدم!`, 'success'))
      .catch(() => onShowToast('تعذر النسخ التلقائي', 'error'));
  };

  const handleSaveSections = () => {
    const updated = {
      ...config,
      sections: { ...sectionsState, dashboard: true },
    };
    onSaveConfig(updated);
    onShowToast('تم حفظ رؤية وتفعيل أقسام التطبيق للعملاء', 'success');
  };

  const handleSaveIdentity = () => {
    const updated: CommercialConfig = {
      ...config,
      name: appName.trim() || config.name,
      owner: ownerName.trim() || config.owner,
      support: supportPhone.trim() || config.support,
      whatsapp: whatsappPhone.trim() || config.whatsapp,
      vodafoneCash: vodafonePhone.trim() || config.vodafoneCash,
      plans: {
        monthly: num(monthlyPrice),
        yearly: num(yearlyPrice),
        lifetime: num(lifetimePrice),
      },
    };
    onSaveConfig(updated);
    onShowToast('تم حفظ هوية التطبيق والأسعار وبيانات التواصل', 'success');
  };

  const handleOpenPromoModal = (promo?: PromotedApp) => {
    if (promo) {
      setPromoId(promo.id);
      setPromoTitle(promo.title);
      setPromoDesc(promo.description);
      setPromoUrl(promo.url);
      setPromoKind(promo.kind || 'موصى به');
      setPromoAffiliate(promo.affiliate);
      setPromoActive(promo.active);
    } else {
      setPromoId('');
      setPromoTitle('');
      setPromoDesc('');
      setPromoUrl('');
      setPromoKind('موصى به');
      setPromoAffiliate(false);
      setPromoActive(true);
    }
    setShowPromoModal(true);
  };

  const handleSavePromo = () => {
    if (!promoTitle.trim() || !promoUrl.trim()) {
      return onShowToast('اكتب اسم الخدمة والرابط أولاً', 'error');
    }
    const list = [...promotions];
    const newItem: PromotedApp = {
      id: promoId || Date.now().toString(36),
      title: promoTitle.trim(),
      description: promoDesc.trim(),
      url: promoUrl.trim(),
      kind: promoKind.trim() || 'موصى به',
      affiliate: promoAffiliate,
      active: promoActive,
    };

    const idx = list.findIndex((x) => x.id === promoId);
    if (idx >= 0) list[idx] = newItem;
    else list.push(newItem);

    setPromotions(list);
    localStorage.setItem('plm_promotions', JSON.stringify(list));
    setShowPromoModal(false);
    onShowToast('تم حفظ رابط الترويج بنجاح', 'success');
  };

  const handleDeletePromo = (id: string) => {
    if (!confirm('حذف هذا الرابط الترويجي؟')) return;
    const filtered = promotions.filter((x) => x.id !== id);
    setPromotions(filtered);
    localStorage.setItem('plm_promotions', JSON.stringify(filtered));
    onShowToast('تم حذف الرابط', 'success');
  };

  const handleResolveTicket = async (ticket: SupportTicket) => {
    const updated: SupportTicket = {
      ...ticket,
      status: 'resolved',
      replyNote: replyText.trim() || ticket.replyNote || 'تمت المعالجة بواسطة المالك.',
      resolvedAt: nowISO(),
    };
    await dbPut('tickets', updated);
    setReplyTicket(null);
    setReplyText('');
    onShowToast('تمت معالجة تذكرة المشكلة وإرسال الحل', 'success');
    loadOwnerData();
  };

  const handleGenerateAndAssignCodeToTicket = async (ticket: SupportTicket) => {
    const newCodeItem: SubscriptionCode = {
      id: Date.now().toString(36),
      code: makeSubscriptionCode(),
      plan: 'yearly',
      createdAt: nowISO(),
      status: 'unused',
      note: `هدية دعم للعميل ${ticket.userName}`,
    };
    await dbPut('codes', newCodeItem);

    const updated: SupportTicket = {
      ...ticket,
      status: 'resolved',
      replyNote: `تم تفعيل حسابك وإصدار كود اشتراك لك: (${newCodeItem.code}). يسعدنا خدمتك دائمًا!`,
      resolvedAt: nowISO(),
    };
    await dbPut('tickets', updated);
    onShowToast(`تم إنشاء الكود ${newCodeItem.code} وحل مشكلة العميل!`, 'success');
    loadOwnerData();
  };

  const unusedCount = codes.filter((x) => x.status === 'unused').length;
  const usedCount = codes.filter((x) => x.status === 'used').length;
  const disabledCount = codes.filter((x) => x.status === 'disabled').length;
  const openTicketsCount = tickets.filter((x) => x.status !== 'resolved').length;

  const sectionLabels: Record<string, string> = {
    dashboard: 'الرئيسية (إجباري)',
    money: 'المال والحسابات',
    obligations: 'الديون والأقساط',
    bills: 'الفواتير والاستحقاقات',
    subscriptions: 'الاشتراكات المتكررة',
    reminders: 'التذكيرات',
    goals: 'الأهداف المالية',
    documents: 'المستندات والضمانات',
    budgets: 'الميزانيات والتصنيفات',
    reports: 'التقارير والتحليلات',
    plans: 'الخطط والاشتراك',
    promotions: 'التطبيقات والخدمات',
    legal: 'الخصوصية والشروط',
    settings: 'الإعدادات',
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>👑 لوحة تحكم المالك والمصمم المحترفة</h3>
          <p>
            التحكم الكامل في هوية التطبيق، توليد الأكواد، الأقساط، تفعيل المشتركين وحل مشكلات العملاء.
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadOwnerData}
          >
            ↻ تحديث البيانات
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onLogout}
          >
            🔒 خروج
          </button>
        </div>
      </div>

      <div className="card panel owner-warning">
        <strong>🔐 Owner Control Center Active</strong>
        <p>
          كلمة مرور المالك المفتاحية: <b>{OWNER_PASSWORD}</b>. أهلاً بك يا <b>{config.owner}</b>! يمكنك التحكم في تفعيل واختفاء الأقسام، توليد وتصدير أكواد التفعيل، وحل بلاغات وتذاكر الدعم للعملاء مباشرة.
        </p>
      </div>

      <div className="grid3" style={{ marginTop: '15px' }}>
        <div className="card stat">
          <div className="label">الأكواد غير المستخدمة</div>
          <div className="value">{unusedCount}</div>
          <div className="sub">جاهزة للعملاء</div>
        </div>
        <div className="card stat">
          <div className="label">الأكواد المستخدمة</div>
          <div className="value kpi-positive">{usedCount}</div>
          <div className="sub">تم تفعيلها بالكامل</div>
        </div>
        <div className="card stat">
          <div className="label">تذاكر المشكلات المفتوحة</div>
          <div className="value amount-expense">{openTicketsCount}</div>
          <div className="sub">تحتاج لمراجعة المالك</div>
        </div>
      </div>

      {/* Customer Support & Tickets Resolution Section */}
      <div className="card panel" style={{ marginTop: '15px' }}>
        <div className="panel-head">
          <h4>📩 تذاكر وبلاغات المشاكل من العملاء ({tickets.length})</h4>
          <span className="badge badge-danger">خدمة العملاء</span>
        </div>
        <p className="muted" style={{ fontSize: '11px', lineHeight: 1.8 }}>
          يستطيع العميل إرسال مشكلته من صفحة الإعدادات أو الخطط، وتظهر لك هنا مع رقم هاتفه لحلها أو منح كود تفعيل مباشر.
        </p>
        <div className="table-wrap" style={{ marginTop: '10px' }}>
          <table className="table">
            <thead>
              <tr>
                <th>العميل</th>
                <th>التواصل / الهاتف</th>
                <th>الموضوع</th>
                <th>تفاصيل الرسالة</th>
                <th>التاريخ</th>
                <th>الحالة</th>
                <th>إجراءات المالك</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length ? (
                tickets.map((t) => (
                  <tr key={t.id}>
                    <td><b>{esc(t.userName)}</b></td>
                    <td><b style={{ direction: 'ltr', display: 'inline-block' }}>{esc(t.userContact)}</b></td>
                    <td>{esc(t.subject)}</td>
                    <td style={{ maxWidth: '220px', whiteSpace: 'normal', fontSize: '11px' }}>{esc(t.message)}</td>
                    <td>{esc((t.createdAt || '').slice(0, 10))}</td>
                    <td>
                      <span
                        className={`badge ${
                          t.status === 'resolved' ? 'badge-success' : 'badge-danger'
                        }`}
                      >
                        {t.status === 'resolved' ? 'محلولة' : 'جديدة / معلقة'}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setReplyTicket(t);
                            setReplyText(t.replyNote || '');
                          }}
                        >
                          💬 رد وحل
                        </button>
                        {t.status !== 'resolved' && (
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => handleGenerateAndAssignCodeToTicket(t)}
                          >
                            🎟️ إهداء كود
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">لا توجد بلاغات أو تذاكر مشكلات مرسلة من العملاء.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Generator Section */}
      <div className="card panel" style={{ marginTop: '15px' }}>
        <div className="panel-head">
          <h4>🎟️ مولد أكواد الاشتراك والتفعيل</h4>
          <span className="badge badge-success">إصدار الأكواد</span>
        </div>
        <div className="config-grid">
          <div className="form-group">
            <label>نوع الخطة</label>
            <select
              className="form-control"
              value={codePlan}
              onChange={(e: any) => setCodePlan(e.target.value)}
            >
              <option value="monthly">شهري ({config.plans.monthly} ج)</option>
              <option value="yearly">سنوي ({config.plans.yearly} ج)</option>
              <option value="lifetime">مدى الحياة ({config.plans.lifetime} ج)</option>
              <option value="trial">تجريبي / مخصص</option>
            </select>
          </div>
          <div className="form-group">
            <label>عدد الأكواد المطلوبة</label>
            <input
              type="number"
              className="form-control"
              min={1}
              max={100}
              value={codeCount}
              onChange={(e) => setCodeCount(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>تاريخ الانتهاء (اختياري)</label>
            <input
              type="date"
              className="form-control"
              value={codeExpiry}
              onChange={(e) => setCodeExpiry(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>ملاحظة داخلية للمالك</label>
            <input
              className="form-control"
              placeholder="مثال: دفعة عميل أونلاين"
              value={codeNote}
              onChange={(e) => setCodeNote(e.target.value)}
            />
          </div>
        </div>
        <div className="actions" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerateCodes}
          >
            ＋ توليد الأكواد الآن
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleCopyUnusedCodes}
          >
            📋 نسخ الأكواد غير المستخدمة
          </button>
        </div>
      </div>

      {/* Codes Table */}
      <div className="card panel" style={{ marginTop: '15px' }}>
        <div className="panel-head">
          <h4>📋 سجل الأكواد المنشأة ({codes.length})</h4>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الكود</th>
                <th>الخطة</th>
                <th>الحالة</th>
                <th>تاريخ الإنشاء</th>
                <th>الانتهاء</th>
                <th>ملاحظة</th>
                <th>تحكم</th>
              </tr>
            </thead>
            <tbody>
              {codes.length ? (
                codes.slice(0, 100).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b style={{ direction: 'ltr', display: 'inline-block' }}>
                        {esc(c.code)}
                      </b>
                    </td>
                    <td>{esc(c.plan)}</td>
                    <td>
                      <span
                        className={`badge ${
                          c.status === 'unused'
                            ? 'badge-success'
                            : c.status === 'used'
                            ? 'badge-info'
                            : 'badge-danger'
                        }`}
                      >
                        {c.status === 'unused'
                          ? '🟢 غير مستخدم'
                          : c.status === 'used'
                          ? '🔵 مستخدم'
                          : '🔴 معطل'}
                      </span>
                    </td>
                    <td>{esc((c.createdAt || '').slice(0, 10))}</td>
                    <td>{esc(c.expiresAt || '—')}</td>
                    <td>{esc(c.note || '—')}</td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleToggleCodeStatus(c)}
                        >
                          {c.status === 'disabled' ? 'تفعيل' : 'تعطيل'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteCode(c.id)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">لم يتم توليد أي أكواد اشتراك حتى الآن.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sections Visibility Toggles */}
      <div className="card panel" style={{ marginTop: '15px' }}>
        <div className="panel-head">
          <h4>🧩 التحكم في إخفاء وإظهار أقسام التطبيق للعملاء</h4>
          <span className="badge badge-info">تحكم الأقسام</span>
        </div>
        <p className="muted" style={{ fontSize: '11px', lineHeight: 1.8 }}>
          أي قسم يتم إلغاء تحديده هنا، لن يظهر في القائمة الجانبية أو السفلية للمستخدمين العاديين.
        </p>
        <div className="config-grid owner-sections-grid" style={{ marginTop: '10px' }}>
          {Object.entries(sectionLabels).map(([secKey, secLabel]) => (
            <label key={secKey} className="setting-item">
              <span>
                <b>{secLabel}</b>
                <small className="muted" style={{ display: 'block' }}>{secKey}</small>
              </span>
              <input
                type="checkbox"
                disabled={secKey === 'dashboard'}
                checked={sectionsState[secKey] !== false}
                onChange={(e) =>
                  setSectionsState({ ...sectionsState, [secKey]: e.target.checked })
                }
              />
            </label>
          ))}
        </div>
        <div className="actions" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveSections}
          >
            💾 حفظ خيارات ظهور الأقسام
          </button>
        </div>
      </div>

      {/* Identity & Commercial Settings Editor */}
      <div className="card panel" style={{ marginTop: '15px' }}>
        <div className="panel-head">
          <h4>⚙️ هوية المنتج والأسعار وأرقام التحويل</h4>
        </div>
        <div className="config-grid">
          <div className="form-group">
            <label>اسم التطبيق الرسمِي</label>
            <input
              className="form-control"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>اسم المالك والمصمم</label>
            <input
              className="form-control"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>رقم الدعم الفني</label>
            <input
              className="form-control"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>رقم WhatsApp للتفعيل</label>
            <input
              className="form-control"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>رقم Vodafone Cash للتحويلات</label>
            <input
              className="form-control"
              value={vodafonePhone}
              onChange={(e) => setVodafonePhone(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>سعر الاشتراك الشهري (ج)</label>
            <input
              type="number"
              className="form-control"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>سعر الاشتراك السنوي (ج)</label>
            <input
              type="number"
              className="form-control"
              value={yearlyPrice}
              onChange={(e) => setYearlyPrice(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>سعر خطة مدى الحياة (ج)</label>
            <input
              type="number"
              className="form-control"
              value={lifetimePrice}
              onChange={(e) => setLifetimePrice(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="actions" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveIdentity}
          >
            💾 حفظ هوية التطبيق والأسعار
          </button>
        </div>
      </div>

      {/* Promoted Apps Manager */}
      <div className="card panel" style={{ marginTop: '15px' }}>
        <div className="panel-head">
          <h4>📣 إدارة روابط التطبيقات والخدمات والمنتجات</h4>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenPromoModal()}
          >
            ＋ إضافة رابط ترويجي
          </button>
        </div>
        <div className="table-wrap" style={{ marginTop: '10px' }}>
          <table className="table">
            <thead>
              <tr>
                <th>اسم الخدمة</th>
                <th>الرابط</th>
                <th>النوع</th>
                <th>عمولة؟</th>
                <th>الحالة</th>
                <th>تحكم</th>
              </tr>
            </thead>
            <tbody>
              {promotions.length ? (
                promotions.map((p) => (
                  <tr key={p.id}>
                    <td><b>{esc(p.title)}</b></td>
                    <td><small style={{ direction: 'ltr', display: 'inline-block' }}>{esc(p.url)}</small></td>
                    <td>{esc(p.kind)}</td>
                    <td>{p.affiliate ? 'نعم (Affiliate)' : 'لا'}</td>
                    <td>{p.active ? '🟢 ظاهر' : '🔴 مخفي'}</td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenPromoModal(p)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeletePromo(p.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">لا توجد روابط ترويجية مضافة.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reply Ticket Modal */}
      {replyTicket && (
        <div className="modal-backdrop show">
          <div className="modal">
            <div className="modal-head">
              <h4>💬 الرد وحل مشكلة العميل: {esc(replyTicket.userName)}</h4>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setReplyTicket(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '12px', marginBottom: '8px' }}>
                <b>بيانات التواصل:</b> {esc(replyTicket.userContact)}
              </p>
              <p style={{ fontSize: '12px', marginBottom: '12px', background: 'var(--surface2)', padding: '10px', borderRadius: '10px' }}>
                <b>رسالة العميل:</b> {esc(replyTicket.message)}
              </p>
              <div className="form-group">
                <label>نص الرد / كود التفعيل الموجه للعميل</label>
                <textarea
                  className="form-control"
                  style={{ minHeight: '100px' }}
                  placeholder="اكتب حلك للمشكلة أو أرفق كود التفعيل هنا..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-success"
                onClick={() => handleResolveTicket(replyTicket)}
              >
                تأكيد الحل وحفظ الرد
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setReplyTicket(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promo Add/Edit Modal */}
      {showPromoModal && (
        <div className="modal-backdrop show">
          <div className="modal">
            <div className="modal-head">
              <h4>{promoId ? 'تعديل رابط ترويجي' : 'إضافة تطبيق أو خدمة'}</h4>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPromoModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>اسم التطبيق / الخدمة</label>
                <input
                  className="form-control"
                  placeholder="مثال: تطبيق الفواتير السريع"
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginTop: '10px' }}>
                <label>الوصف</label>
                <textarea
                  className="form-control"
                  placeholder="شرح مختصر عن الخدمة والمزايا"
                  value={promoDesc}
                  onChange={(e) => setPromoDesc(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginTop: '10px' }}>
                <label>الرابط المباشر (URL)</label>
                <input
                  className="form-control"
                  placeholder="https://example.com"
                  value={promoUrl}
                  onChange={(e) => setPromoUrl(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginTop: '10px' }}>
                <label>نوع الظهور</label>
                <input
                  className="form-control"
                  placeholder="موصى به / إعلان / شريك"
                  value={promoKind}
                  onChange={(e) => setPromoKind(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={promoAffiliate}
                    onChange={(e) => setPromoAffiliate(e.target.checked)}
                  />
                  رابط Affiliate أو يحقق عمولة
                </label>
              </div>
              <div className="form-group" style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={promoActive}
                    onChange={(e) => setPromoActive(e.target.checked)}
                  />
                  ظاهر ومفعل للعملاء
                </label>
              </div>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePromo}
              >
                حفظ الخدمة
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowPromoModal(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="product-footer">
        © {config.year || 2026} {esc(config.owner)} — Owner Control Center
      </div>
    </div>
  );
};
