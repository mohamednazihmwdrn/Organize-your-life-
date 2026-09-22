import React, { useState } from 'react';
import { CommercialConfig } from '../types';
import { num, esc } from '../lib/utils';

interface LegalViewProps {
  config: CommercialConfig;
}

export const LegalView: React.FC<LegalViewProps> = ({ config }) => {
  const [tab, setTab] = useState<'privacy' | 'terms' | 'refund'>('privacy');

  const plans = config.plans || { monthly: 59, yearly: 699, lifetime: 1299 };

  const legalTexts = {
    privacy: {
      title: 'سياسة الخصوصية',
      body: (
        <>
          <h4>1. نطاق السياسة</h4>
          <p>
            توضح هذه السياسة كيفية التعامل مع بياناتك المالية والشخصية داخل تطبيق «{config.name}».
          </p>
          <h4>2. البيانات التي يتم إدخالها</h4>
          <p>
            يمكنك إدخال أسماء الحسابات، الدخل، المصروفات، الديون، الأقساط، الفواتير، التذكيرات والأهداف. لا تطلب الخدمة بيانات حساسة غير ضرورية لعملها.
          </p>
          <h4>3. التخزين المحلي والأمان</h4>
          <p>
            البيانات تُحفظ محليًا وآمنًا على متصفح جهازك باستخدام تقنية IndexedDB. لا يتم بيع أو مشاركة بياناتك المالية مع أي طرف ثالث بدون إذنك.
          </p>
          <h4>4. النسخ الاحتياطي</h4>
          <p>
            أنت مسؤول عن تصدير ملف النسخة الاحتياطية JSON وحفظه في مكان آمن لحماية بياناتك من المسح أو الضياع عند تغيير الجهاز.
          </p>
          <h4>5. قفل PIN</h4>
          <p>
            تتوفر ميزة رمز PIN لتأمين شاشة التطبيق على الأجهزة المشتركة.
          </p>
          <h4>6. التواصل والدعم</h4>
          <p>
            المالك والمصمم: {esc(config.owner)} — WhatsApp / الدعم: {config.support}
          </p>
        </>
      ),
    },
    terms: {
      title: 'شروط الاستخدام',
      body: (
        <>
          <h4>1. قبول الشروط</h4>
          <p>
            باستخدامك لهذا التطبيق، فإنك توافق على الالتزام بشروط الاستخدام والاستفادة من الخدمات المقدمة.
          </p>
          <h4>2. طبيعة الخدمة</h4>
          <p>
            التطبيق عبارة عن أداة تنظيمة ومساعد مالي شخصي لمتابعة الالتزامات والمصروفات، وليس بنكًا أو جهة تقديم استشارات استثمارية رسمية.
          </p>
          <h4>3. الخطط والأسعار الحالية</h4>
          <p>
            الأسعار المعروضة حاليًا: {num(plans.monthly)} جنيه شهريًا، {num(plans.yearly)} جنيه سنويًا، و{num(plans.lifetime)} جنيه لخطة مدى الحياة.
          </p>
          <h4>4. حقوق الملكية</h4>
          <p>
            © 2026 {esc(config.owner)} — جميع حقوق التصميم، الكود، العلامة التجارية والمحتوى محفوظة للمالك بشكل كامل.
          </p>
        </>
      ),
    },
    refund: {
      title: 'سياسة الاسترداد والإلغاء',
      body: (
        <>
          <h4>1. التفعيل والمراجعة</h4>
          <p>
            يتم تفعيل الاشتراك فور إدخال كود التفعيل المعتمد أو تأكيد تحويل Vodafone Cash عبر WhatsApp.
          </p>
          <h4>2. طلبات الدعم والاسترداد</h4>
          <p>
            في حال وجود أي استفسار أو مشكلة في التفعيل، يمكنك التواصل مباشرة مع المالك عبر WhatsApp على الرقم {config.support} لحل المشكلة فورًا.
          </p>
        </>
      ),
    },
  };

  const currentText = legalTexts[tab];

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>⚖️ الخصوصية والشروط وسياسة الخدمة</h3>
          <p>الشروط والأحكام القانونية الخاصة بالمنتج والخدمة.</p>
        </div>
      </div>

      <div className="legal-tabs">
        <button
          type="button"
          className={`btn btn-outline ${tab === 'privacy' ? 'active' : ''}`}
          onClick={() => setTab('privacy')}
        >
          سياسة الخصوصية
        </button>
        <button
          type="button"
          className={`btn btn-outline ${tab === 'terms' ? 'active' : ''}`}
          onClick={() => setTab('terms')}
        >
          شروط الاستخدام
        </button>
        <button
          type="button"
          className={`btn btn-outline ${tab === 'refund' ? 'active' : ''}`}
          onClick={() => setTab('refund')}
        >
          الاسترداد والإلغاء
        </button>
      </div>

      <div className="card panel legal-copy">{currentText.body}</div>

      <div className="product-footer">
        © {config.year || 2026} {esc(config.owner)} — جميع الحقوق محفوظة • WhatsApp: {config.support}
      </div>
    </div>
  );
};
