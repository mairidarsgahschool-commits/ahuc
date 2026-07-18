(function () {
  const form = document.getElementById('gynaeForm');
  if (!form) return;

  function val(name) {
    const el = form.querySelector(`[name="${name}"]:checked`);
    return el ? el.value : null;
  }
  function num(name, fallback) {
    const el = form.querySelector(`[name="${name}"]`);
    const v = el ? el.value : '';
    return v === '' ? fallback : v;
  }
  function selVal(name) {
    const el = form.querySelector(`[name="${name}"]`);
    return el ? el.value : '';
  }
  function setOut(id, text) {
    const el = document.getElementById(id);
    if (el) el.value = text;
  }

  /* ---------------- UTERUS ---------------- */
  function genUterus() {
    const sentences = [];
    const size = val('ut_size'), shape = val('ut_shape');
    const sizeWord = size === 'small' ? 'small' : size === 'enlarged' ? 'enlarged' : 'normal';
    sentences.push(`It is ${shape === 'abnormal' ? 'abnormal' : 'normal'} in shape and ${sizeWord} in size.`);

    if (val('ut_mass') === 'none') {
      sentences.push('No mass or cyst seen in it.');
    } else {
      sentences.push(`A ${selVal('ut_mass_type')} mass is seen ${selVal('ut_mass_location')}, measuring ${num('ut_mass_w', 0)} x ${num('ut_mass_h', 0)} mm.`);
    }

    sentences.push(`Uterus is in ${val('ut_position')} position.`);

    if (val('ut_endo') === 'thickened') {
      sentences.push(`Endometrium is thickened, in keeping with ${selVal('ut_endo_cause')}.`);
    }
    setOut('out_uterus', sentences.join('  '));
  }

  /* ---------------- ADNEXA (shared right/left) ---------------- */
  function genAdnexa(prefix, outId, side) {
    if (val(`${prefix}_status`) === 'normal' && val(`${prefix}_mass`) === 'none') {
      setOut(outId, `${side} adnexa normal.`);
      return;
    }
    const sentences = [];
    sentences.push(`${side} adnexa ${val(`${prefix}_status`) === 'abnormal' ? 'abnormal' : 'normal'}.`);
    if (val(`${prefix}_mass`) === 'yes') {
      const pattern = selVal(`${prefix}_mass_pattern`);
      sentences.push(`A ${selVal(`${prefix}_mass_type`)} tubo-ovarian mass is noted${pattern ? ' (' + pattern + ')' : ''}, with ${selVal(`${prefix}_margins`)}, measuring ${num(`${prefix}_mass_w`, 0)} x ${num(`${prefix}_mass_h`, 0)} mm.`);
    }
    setOut(outId, sentences.join('  '));
  }

  /* ---------------- OVARY (shared right/left) ---------------- */
  function genOvary(prefix, outId) {
    if (val(`${prefix}_size`) === 'normal' && val(`${prefix}_volume`) === 'normal' && val(`${prefix}_mass`) === 'none') {
      setOut(outId, 'It is normal.');
      return;
    }
    const sentences = [];
    sentences.push(`Size is ${val(`${prefix}_size`) === 'abnormal' ? 'abnormal' : 'normal'}, volume is ${val(`${prefix}_volume`) === 'abnormal' ? 'abnormal' : 'normal'}.`);
    if (val(`${prefix}_mass`) === 'yes') {
      const pattern = selVal(`${prefix}_mass_pattern`);
      sentences.push(`A ${selVal(`${prefix}_mass_type`)} tubo-ovarian mass is noted${pattern ? ' (' + pattern + ')' : ''}, with ${selVal(`${prefix}_margins`)}, measuring ${num(`${prefix}_mass_w`, 0)} x ${num(`${prefix}_mass_h`, 0)} mm.`);
    }
    setOut(outId, sentences.join('  '));
  }

  /* ---------------- POUCH OF DOUGLAS ---------------- */
  function genPOD() {
    if (val('pod_size') === 'normal') {
      setOut('out_pod', 'Pouch of douglas is normal.');
    } else {
      setOut('out_pod', `Pouch of douglas contains ${selVal('pod_amount')} of free fluid.`);
    }
  }

  const generators = {
    uterus: genUterus,
    radnexa: () => genAdnexa('ra', 'out_radnexa', 'Right'),
    ladnexa: () => genAdnexa('la', 'out_ladnexa', 'Left'),
    rovary: () => genOvary('ro', 'out_rovary'),
    lovary: () => genOvary('lo', 'out_lovary'),
    pod: genPOD
  };

  form.querySelectorAll('details.organ[data-organ]').forEach((section) => {
    const key = section.getAttribute('data-organ');
    const generate = generators[key];
    if (!generate) return;
    section.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('change', generate);
    });
  });
})();
