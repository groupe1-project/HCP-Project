import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DataVisualizer({
  data_json = [],
  filtres_disponibles = [],
  filtre_par_defaut = {},
  isVisitor = true,
  visitorVisibleColumns = [],
}) {
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...(filtre_par_defaut || {}) }));

  const columns = useMemo(() => {
    const cols = new Set();
    (data_json || []).forEach(r => Object.keys(r || {}).forEach(k => cols.add(k)));
    return Array.from(cols);
  }, [data_json]);

  const labelColumn = useMemo(() => {
    const names = columns.map(c => String(c).toLowerCase());
    const idx = names.findIndex(n => /province|region|commune|district|wilaya|name|territoire/i.test(n));
    if (idx >= 0) return columns[idx];
    for (const c of columns) {
      if (filtres_disponibles.includes(c)) continue;
      const sample = (data_json || []).find(r => r && r[c] !== null && r[c] !== undefined);
      if (!sample) continue;
      if (typeof sample[c] === 'string') return c;
    }
    return columns[0] || 'label';
  }, [columns, data_json, filtres_disponibles]);

  const valueColumn = useMemo(() => {
    const names = columns.map(c => String(c).toLowerCase());
    const preferIdx = names.findIndex(n => /valeur|value|count|nombre|total|effectif/i.test(n));
    if (preferIdx >= 0) return columns[preferIdx];
    for (const c of columns) {
      const sample = (data_json || []).find(r => r && r[c] !== null && r[c] !== undefined && r[c] !== '');
      if (!sample) continue;
      const v = sample[c];
      if (typeof v === 'number' || (!isNaN(parseFloat(String(v).replace(/,/g, '.'))))) return c;
    }
    return columns[columns.length - 1] || 'value';
  }, [columns, data_json]);

  const optionsFor = useMemo(() => {
    const map = {};
    (filtres_disponibles || []).forEach(col => {
      const s = new Set();
      (data_json || []).forEach(r => {
        const v = r && r[col];
        if (v !== null && v !== undefined) s.add(String(v));
      });
      map[col] = Array.from(s).sort();
    });
    return map;
  }, [data_json, filtres_disponibles]);

  useEffect(() => {
    if (isVisitor && filtre_par_defaut) {
      setAppliedFilters(prev => ({ ...filtre_par_defaut, ...prev }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local tooltip: hide zero-valued entries for a cleaner display
  const CustomTooltipLocal = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    const items = payload.filter(p => p && Number(p.value) !== 0 && p.value !== null && p.value !== undefined);
    if (!items || items.length === 0) return null;
    return (
      <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
        <div className="font-bold mb-1">{label}</div>
        {items.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div style={{ width: 10, height: 10, background: p.color || p.fill || '#000' }} />
            <div className="font-semibold">{p.name || 'Valeur'}</div>
            <div className="ml-2">: {p.value}</div>
          </div>
        ))}
      </div>
    );
  };

  const filteredRows = useMemo(() => {
    if (!data_json || !Array.isArray(data_json)) return [];
    return data_json.filter(row => {
      return Object.keys(appliedFilters || {}).every(col => {
        const val = appliedFilters[col];
        if (val === null || val === undefined || val === '') return true;
        return String(row[col] ?? '') === String(val);
      });
    });
  }, [data_json, appliedFilters]);

  const chartData = useMemo(() => {
    const map = new Map();
    (filteredRows || []).forEach(r => {
      const key = String(r[labelColumn] ?? '');
      const raw = r[valueColumn];
      const num = raw === null || raw === undefined || raw === '' ? 0 : parseFloat(String(raw).replace(/,/g, '.')) || 0;
      map.set(key, (map.get(key) || 0) + num);
    });
    return Array.from(map.entries()).map(([k, v]) => ({ [labelColumn]: k, value: v }));
  }, [filteredRows, labelColumn, valueColumn]);

  const visibleColumns = useMemo(() => {
    if (isVisitor) {
      if (visitorVisibleColumns && visitorVisibleColumns.length) return visitorVisibleColumns;
      return [labelColumn, valueColumn];
    }
    return columns.filter(c => !(filtres_disponibles.includes(c) && appliedFilters[c] === 'Total'));
  }, [isVisitor, columns, filtres_disponibles, appliedFilters, labelColumn, valueColumn, visitorVisibleColumns]);

  const renderRows = () => {
    if (isVisitor) {
      // visitor: show blanks for repeated values (existing behavior)
      const prev = {};
      return (filteredRows || []).map((row, idx) => (
        <tr key={idx} className="border-b border-gray-200">
          {visibleColumns.map(col => {
            const cell = row[col];
            const display = (prev[col] !== undefined && String(prev[col]) === String(cell)) ? '' : cell;
            prev[col] = cell;
            return <td key={col} className="p-2 text-sm border-r">{display}</td>;
          })}
        </tr>
      ));
    }

    // Admin view: compute rowSpan for consecutive identical cells so we can merge cells vertically
    const rowCount = (filteredRows || []).length;
    const spans = {}; // spans[col] = Array(rowCount) with rowspan or 0
    visibleColumns.forEach(col => {
      spans[col] = new Array(rowCount).fill(0);
      let i = 0;
      while (i < rowCount) {
        const val = String((filteredRows[i] && filteredRows[i][col]) ?? '');
        let j = i + 1;
        while (j < rowCount && String((filteredRows[j] && filteredRows[j][col]) ?? '') === val) j++;
        const span = j - i;
        spans[col][i] = span; // only first row gets the span (>0)
        // others remain 0 meaning they should not render the td
        i = j;
      }
    });

    return (filteredRows || []).map((row, idx) => (
      <tr key={idx} className="border-b border-gray-200">
        {visibleColumns.map(col => {
          const span = spans[col][idx] || 0;
          if (span === 0) return null; // merged into previous cell
          const cell = row[col];
          return (
            <td key={col} rowSpan={span} className="p-2 text-sm border-r align-top">
              {cell}
            </td>
          );
        })}
      </tr>
    ));
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:gap-4 gap-2">
        {(filtres_disponibles || []).map(col => (
          <div key={col} className="flex-1">
            <label className="block text-xs font-semibold mb-1">{col}</label>
            <select
              className="w-full p-2 border rounded bg-white"
              value={appliedFilters[col] ?? ''}
              onChange={e => setAppliedFilters(prev => ({ ...prev, [col]: e.target.value }))}
            >
              <option value="">-- Tous --</option>
              {optionsFor[col]?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {isVisitor && (
        <div className="text-sm text-gray-700 p-2 bg-yellow-50 rounded">Par défaut, les chiffres affichés correspondent aux totaux. Utilisez les filtres pour explorer les données par milieu ou par sexe.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="overflow-auto border rounded">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                {visibleColumns.map(col => (
                  <th key={col} className="p-2 text-left text-xs font-bold border-r">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderRows()}
            </tbody>
          </table>
        </div>

        <div style={{ height: 300 }} className="w-full">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={labelColumn} />
              <YAxis />
              <Tooltip content={<CustomTooltipLocal />} />
              <Bar dataKey="value" fill="#4a77b4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
