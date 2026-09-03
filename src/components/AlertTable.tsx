import { FalhaEvent } from '../types';

interface AlertTableProps {
  falhas: FalhaEvent[];
  onRetry: (id: number) => Promise<void> | void;
}

function formatDateDisplay(isoString?: string | null): string {
  if (!isoString) return '-';

  try {
    const cleanStr = String(isoString).replace('Z', '').split('+')[0];
    const [datePart, timePart] = cleanStr.split('T');
    
    if (!datePart || !timePart) return String(isoString);

    const [year, month, day] = datePart.split('-');
    const [hour, minute, second] = timePart.split(':');

    if (!year || !month || !day || !hour || !minute) return String(isoString);

    const sec = second ? second.substring(0, 2) : '00';

    return `${day}/${month}/${year}, ${hour}:${minute}:${sec}`;
  } catch {
    return String(isoString || '-');
  }
}

export function AlertTable({ falhas, onRetry }: AlertTableProps) {
  const renderStatus = (status: number, errorMessage?: string | null) => {
    switch (status) {
      case 0:
        return (
          <span
            title={errorMessage || 'Evento aguardando envio'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#285995]/20 text-[#6ba4e8] border border-[#285995]/40 font-mono"
          >
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
          <span
            title={errorMessage || 'Falha com erro'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono"
          >
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
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm text-[#D3D6D9] border-collapse">
          <thead>
            <tr className="bg-[#1F2730] border-b border-[#5A656C]/40 text-white font-bold text-xs tracking-wider">
              <th className="py-3 px-4 border-r border-[#5A656C]/30 w-16">id</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-37.5">equipamento_id</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-45">setor</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-42.5">user</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-40">status</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-42.5">creat-at</th>
              <th className="py-3 px-4 border-r border-[#5A656C]/30 min-w-42.5">update_at</th>
              <th className="py-3 px-4 min-w-30">ações</th>
            </tr>

            <tr className="bg-[#161C22] border-b border-[#5A656C]/40 text-[#8C9BA5] text-[11px] font-normal italic">
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">identificador de falhas</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">identificador do equipamento</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">setor, local da instalação do equipamento</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">destinatário do envio da mensagem</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">0 quando inserido falha no banco e 1 quando enviado</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">momento da falha</td>
              <td className="py-2.5 px-4 border-r border-[#5A656C]/25">momento do envio da mensagem</td>
              <td className="py-2.5 px-4">reprocessamento e diagnóstico</td>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#5A656C]/25 bg-[#181F26] text-xs">
            {falhas.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-[#5A656C] font-sans">
                  Nenhuma falha atende aos filtros atuais.
                </td>
              </tr>
            ) : (
              falhas.map((falha) => (
                <tr key={falha.id} className="hover:bg-[#1E2630] transition-colors font-mono">
                  <td className="py-3 px-4 font-bold text-[#D3D6D9] border-r border-[#5A656C]/20 whitespace-nowrap">
                    {falha.id}
                  </td>

                  <td className="py-3 px-4 font-bold text-white border-r border-[#5A656C]/20 whitespace-nowrap">
                    {falha.equipamento_id}
                  </td>

                  <td className="py-3 px-4 text-[#D3D6D9] font-sans border-r border-[#5A656C]/20 whitespace-nowrap">
                    {falha.setor || '-'}
                  </td>

                  <td className="py-3 px-4 text-[#6ba4e8] font-bold border-r border-[#5A656C]/20 whitespace-nowrap">
                    {falha.user}
                  </td>

                  <td className="py-3 px-4 border-r border-[#5A656C]/20 whitespace-nowrap font-sans">
                    {renderStatus(falha.status, falha.error_message)}
                  </td>

                  <td className="py-3 px-4 text-[#D3D6D9] border-r border-[#5A656C]/20 whitespace-nowrap">
                    {formatDateDisplay(falha.creat_at)}
                  </td>

                  <td className="py-3 px-4 border-r border-[#5A656C]/20 whitespace-nowrap">
                    {falha.update_at ? (
                      <span className="text-emerald-400 font-semibold">{formatDateDisplay(falha.update_at)}</span>
                    ) : (
                      <span className="text-[#5A656C] font-sans italic text-[11px]">-</span>
                    )}
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    {falha.status === 1 ? (
                      <span className="text-[11px] text-[#5A656C] italic">Concluído</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRetry(falha.id)}
                        className="rounded-lg border border-[#285995]/30 bg-[#285995]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#6ba4e8] transition hover:bg-[#285995]/20 disabled:cursor-not-allowed disabled:opacity-50"
                        title={falha.error_message || 'Reenviar evento para processamento'}
                      >
                        Reprocessar
                      </button>
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