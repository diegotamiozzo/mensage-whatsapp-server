import { FalhaEvent } from '../types';

interface AlertTableProps {
  falhas: FalhaEvent[];
}

function formatDateDisplay(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    if (typeof isoString === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(isoString)) {
      const [datePart, timePartRaw] = isoString.split(/[ T]/);
      const [year, month, day] = datePart.split('-');
      const timePart = timePartRaw.substring(0, 8);
      return `${day}/${month}/${year} ${timePart}`;
    }
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${h}:${m}:${s}`;
  } catch {
    return String(isoString || '-');
  }
}

export function AlertTable({ falhas }: AlertTableProps) {
  const renderStatus = (status: number) => {
    switch (status) {
      case 0:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#285995]/20 text-[#6ba4e8] border border-[#285995]/40 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#285995] animate-ping"></span>
            0 (Pendente)
          </span>
        );
      case 1:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            1 (Enviado)
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-spin"></span>
            2 (Processando)
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            3 (Erro)
          </span>
        );
      default:
        return <span className="font-mono text-xs text-[#D3D6D9]">{status}</span>;
    }
  };

  return (
    <div className="w-full bg-[#181F26] border border-[#5A656C]/35 rounded-xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-[#D3D6D9] border-collapse">
          {/* Header Rows */}
          <thead>
            {/* Linha 1: Nomes das Colunas */}
            <tr className="bg-[#1F2730] border-b border-[#5A656C]/40 text-white font-bold text-xs tracking-wider">
              <th className="py-3 px-4 border-r border-[#5A656C]/30 w-16">id</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-37.5">equipamento_id</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-45">setor</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-40">user</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-35">status</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-42.5">creat-at</th>
              <th className="py-3 px-4 min-w-42.5">update_at</th>
            </tr>

            {/* Linha 2: Descrições das Colunas conforme a planilha */}
            <tr className="bg-[#161C22] border-b border-[#5A656C]/40 text-[#8C9BA5] text-[11px] font-normal italic">
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">identificador de falhas</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">identificador do equipamento</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">setor, local da instalação do equipamento</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">destinatário do envio da mensagem</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">0 quando inserido falha no banco e 1 quando enviado</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">momento da falha</td>
              <td className="py-2.5 px-4">momento do envio da mensagem</td>
            </tr>
          </thead>

          {/* Dados das Falhas */}
          <tbody className="divide-y divide-[#5A656C]/25 bg-[#181F26] text-xs">
            {falhas.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-[#5A656C] font-sans">
                  Aguardando inserção de novas falhas no banco de dados...
                </td>
              </tr>
            ) : (
              falhas.map((falha) => (
                <tr key={falha.id} className="hover:bg-[#1E2630] transition-colors font-mono">
                  {/* id */}
                  <td className="py-3 px-4 font-bold text-[#D3D6D9] border-r border-[#5A656C]/20 whitespace-nowrap">
                    {falha.id}
                  </td>

                  {/* equipamento_id */}
                  <td className="py-3 px-4 font-bold text-white border-r border-[#5A656C]/20 whitespace-nowrap">
                    {falha.equipamento_id}
                  </td>

                  {/* setor */}
                  <td className="py-3 px-4 text-[#D3D6D9] font-sans border-r border-[#5A656C]/20 whitespace-nowrap">
                    {falha.setor || '-'}
                  </td>

                  {/* user */}
                  <td className="py-3 px-4 text-[#6ba4e8] font-bold border-r border-[#5A656C]/20 whitespace-nowrap">
                    {falha.user}
                  </td>

                  {/* status */}
                  <td className="py-3 px-4 border-r border-[#5A656C]/20 whitespace-nowrap font-sans">
                    {renderStatus(falha.status)}
                  </td>

                  {/* creat_at */}
                  <td className="py-3 px-4 text-[#D3D6D9] border-r border-[#5A656C]/20 whitespace-nowrap">
                    {formatDateDisplay(falha.creat_at)}
                  </td>

                  {/* update_at */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {falha.update_at ? (
                      <span className="text-emerald-400 font-semibold">{formatDateDisplay(falha.update_at)}</span>
                    ) : (
                      <span className="text-[#5A656C] font-sans italic text-[11px]">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}