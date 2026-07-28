import React from 'react';
import { Callout, KPI, Note, SectionTag } from './AnalysisUI';

export const HojaDeRuta: React.FC = () => {
  return (
    <div className="space-y-16 pb-24">
      {/* Header */}
      <div className="bg-[#121f10] text-[#f5f4f2] p-8 sm:p-14 border-b-4 border-[#773357] rounded-t-2xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#869581] mb-4">Refrendo Digital · Morelos 2026 · Para tomadores de decisión</div>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
              Hoja de ruta:<br/><em className="text-[#e791ba] not-italic">accionables con respaldo de datos</em>
            </h1>
          </div>
          <div className="text-right font-mono text-[11px] text-[#546250] leading-loose shrink-0">
            4 iniciativas priorizadas<br/>
            respaldadas por 729K registros<br/>
            mayo 2026
          </div>
        </div>
      </div>

      <div className="bg-[#773357] text-[#f5f4f2] px-8 py-5 text-[13px] leading-relaxed flex items-center gap-4 rounded-b-xl -mt-16">
        <span className="text-lg shrink-0">→</span>
        <span>Este documento propone acciones concretas ordenadas por <strong className="text-[#ffecf2] font-semibold">impacto en recaudación vs. esfuerzo de implementación</strong>. Cada propuesta cita el dato específico que la justifica. El objetivo no es presentar problemas — es llegar con soluciones que ya tienen denominador.</span>
      </div>

      {/* Item 1 */}
      <div className="pt-10 flex flex-col md:flex-row gap-8 md:gap-12 border-b border-[#e4e3d6] pb-14">
        <div className="md:w-48 shrink-0 md:sticky md:top-24 h-fit">
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[#869581] mb-2.5">Accionable</div>
          <div className="font-serif text-6xl font-bold leading-none text-[#cbcabe] mb-4">01</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded bg-[#e8f0fc] text-[#1a4a8c] border border-[#b2ccff]">Técnico</span>
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded bg-[#ffefb6] text-[#936901] border border-[#e7b400]">Operativo</span>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-[#869581] mb-1.5">Esfuerzo estimado</div>
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#121f10]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#121f10]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="font-mono text-[13px] tracking-[0.04em] text-[#869581] mb-4">Flujo del trámite · Validación de identidad</div>
          <h2 className="font-serif text-2xl font-bold leading-tight mb-2">Rediseñar el paso de verificación de propietario</h2>
          <p className="text-[13.5px] text-[#546250] leading-[1.75] mb-4 max-w-xl">29,771 placas únicas están bloqueadas porque el sistema no puede confirmar que el ciudadano que inicia sesión es el propietario registrado en el padrón vehicular. El error más frecuente no es una confusión de nombres — es un problema de flujo: la cuenta de Llave MX con la que el ciudadano inicia sesión no coincide con el titular del vehículo.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[1px] bg-[#e4e3d6] border border-[#e4e3d6] rounded-md overflow-hidden my-5">
            <KPI label="Placas bloqueadas" value="29,771" sub="autos con intención probada · 1.4 intentos promedio" color="m" />
            <KPI label="Potencial si se resuelve" value="$26.2M" sub="a $880 promedio por vehículo" color="g" />
            <KPI label="Error dominante" value={<span className="text-xl">29,602 casos</span>} sub="usuario Llave MX no coincide con titular del vehículo" />
          </div>

          <Callout>
            Este no es un problema de fuzzy matching. El sistema funciona correctamente — detecta que la cuenta de acceso no pertenece al propietario registrado. El caso más común es: <em className="text-[#e791ba]">el vehículo está a nombre de un familiar y el ciudadano usa su propia cuenta</em>. La solución no es técnica, es de diseño del flujo: permitir que el propietario registrado autorice a un representante, o comunicar claramente antes del paso que se requiere la cuenta del titular.
          </Callout>

          <p className="text-[13.5px] text-[#546250] leading-[1.75] mb-4 max-w-xl">Hay un segundo mensaje con 13,113 ocurrencias: "el vehículo está registrado a nombre de otra persona, el trámite debe realizarlo el propietario registrado." Ese caso sí es un bloqueo duro y no tiene solución sin cambio de política. Vale aislar ambos grupos para estimar el potencial real de cada uno antes de diseñar la solución.</p>

          <Note title="Propuesta concreta:">Agregar una pantalla informativa antes del paso que explique: "Para continuar, debes ingresar con la cuenta Llave MX del propietario registrado del vehículo." Esto solo requiere un cambio de UX, no de lógica del sistema, y puede reducir el abandono en este paso de forma inmediata.</Note>
        </div>
      </div>

      {/* Item 2 */}
      <div className="pt-10 flex flex-col md:flex-row gap-8 md:gap-12 border-b border-[#e4e3d6] pb-14">
        <div className="md:w-48 shrink-0 md:sticky md:top-24 h-fit">
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[#869581] mb-2.5">Accionable</div>
          <div className="font-serif text-6xl font-bold leading-none text-[#cbcabe] mb-4">02</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded bg-[#ffefb6] text-[#936901] border border-[#e7b400]">Operativo</span>
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded bg-[#ffecf2] text-[#773357] border border-[#e0a8c4]">Institucional</span>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-[#869581] mb-1.5">Esfuerzo estimado</div>
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#121f10]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#121f10]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#121f10]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="font-mono text-[13px] tracking-[0.04em] text-[#869581] mb-4">Comunicación ciudadana · Reactivación</div>
          <h2 className="font-serif text-2xl font-bold leading-tight mb-2">Campaña de reactivación segmentada por paso</h2>
          <p className="text-[13.5px] text-[#546250] leading-[1.75] mb-4 max-w-xl">137,755 autos llegaron al sistema, identificaron su vehículo y no pagaron — llevan más de 30 días sin actividad. No son ciudadanos desconocidos: tienen placa, tienen cuenta de Llave MX, y demostraron intención al entrar al sistema. El mensaje correcto para cada uno depende de dónde se bloqueó.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1px] bg-[#e4e3d6] border border-[#e4e3d6] rounded-md overflow-hidden my-5">
            <KPI label="Autos con intención probada (>30d)" value="137,755" sub="identificaron su auto · no llegaron a pagar" color="m" />
            <KPI label="Potencial total" value="$121.3M" sub="escenario 20–30% recuperable: $24M–$36M" color="g" />
          </div>

          <Callout subtitle="El segmento de Pago es el más valioso de la campaña">
            <em className="text-[#e791ba]">El segmento de Pago con 3.1 intentos promedio</em> es el más valioso de la campaña: llegaron al último paso múltiples veces. El problema no es falta de intención — es que algo técnico o de usabilidad los detuvo ahí. Antes de notificarlos, vale revisar si hay un error de integración recurrente en ese paso.
          </Callout>
        </div>
      </div>

      {/* Item 3 */}
      <div className="pt-10 flex flex-col md:flex-row gap-8 md:gap-12 border-b border-[#e4e3d6] pb-14">
        <div className="md:w-48 shrink-0 md:sticky md:top-24 h-fit">
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[#869581] mb-2.5">Accionable</div>
          <div className="font-serif text-6xl font-bold leading-none text-[#cbcabe] mb-4">03</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded bg-[#e8f0fc] text-[#1a4a8c] border border-[#b2ccff]">Técnico</span>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-[#869581] mb-1.5">Esfuerzo estimado</div>
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#121f10]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="font-mono text-[13px] tracking-[0.04em] text-[#869581] mb-4">Higiene del sistema · Medición futura</div>
          <h2 className="font-serif text-2xl font-bold leading-tight mb-2">Implementar expiración automática de trámites abandonados</h2>
          <p className="text-[13.5px] text-[#546250] leading-[1.75] mb-4 max-w-xl">El sistema acumula trámites en estado <code className="font-mono text-[11px] bg-[#ebeade] px-1.5 py-0.5 rounded">in_progress</code> que nunca se cerrarán. Hoy el 34.1% de todos los trámites activos llevan más de 90 días sin actividad. Eso no es un problema técnico inmediato — es un problema de medición: mientras existan, cualquier métrica de conversión futura estará contaminada.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[1px] bg-[#e4e3d6] border border-[#e4e3d6] rounded-md overflow-hidden my-5">
            <KPI label="In_progress > 90 días" value="133,746" sub="34.1% del total en progreso · nunca se cerrarán solos" color="r" />
            <KPI label="Impacto en métricas" value={<span className="text-xl">Conversión real</span>} sub="hoy subestimada porque el denominador incluye trámites muertos" />
            <KPI label="Esfuerzo técnico" value={<span className="text-xl">Bajo</span>} sub="job programado · no requiere cambios en el flujo del ciudadano" />
          </div>

          <Note title="Propuesta concreta:">Job automático que transicione a <code className="font-mono text-[11px]">expired</code> los trámites con más de 90 días sin actividad, previa notificación al ciudadano a los 75 días ("tu trámite vence en 15 días"). Esto también crea un canal de reactivación natural antes de la expiración.</Note>
        </div>
      </div>

      {/* Item 4 */}
      <div className="pt-10 flex flex-col md:flex-row gap-8 md:gap-12 pb-14">
        <div className="md:w-48 shrink-0 md:sticky md:top-24 h-fit">
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[#869581] mb-2.5">Accionable</div>
          <div className="font-serif text-6xl font-bold leading-none text-[#cbcabe] mb-4">04</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded bg-[#ffecf2] text-[#773357] border border-[#e0a8c4]">Institucional</span>
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded bg-[#e8f0fc] text-[#1a4a8c] border border-[#b2ccff]">Técnico</span>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-[#869581] mb-1.5">Esfuerzo estimado</div>
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#121f10]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#121f10]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#121f10]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#e4e3d6] border border-[#cbcabe]"></div>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="font-mono text-[13px] tracking-[0.04em] text-[#869581] mb-4">Observabilidad · Gestión continua</div>
          <h2 className="font-serif text-2xl font-bold leading-tight mb-2">Tablero de monitoreo permanente del sistema</h2>
          <p className="text-[13.5px] text-[#546250] leading-[1.75] mb-4 max-w-xl">Hoy la única forma de saber si el sistema está fallando es que alguien solicite un análisis. Los errores técnicos de los días 1 y 2 de abril — con un ratio de 0.45 errores por trámite completado — probablemente pasaron sin que nadie en la operación lo supiera en tiempo real.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1px] bg-[#e4e3d6] border border-[#e4e3d6] rounded-md overflow-hidden my-5">
            <KPI label="Días alta fricción técnica vs. recaudación" value="–$701K/día" sub="diferencia promedio en días con >P75 de errores técnicos vs. días normales" color="r" />
            <KPI label="Incidente 1–2 abril sin alerta" value="721 errores" sub="en 2 días · ratio 0.45 errores/trámite · no detectado en operación" color="r" />
          </div>

          <Callout>
            Un tablero no es un lujo analítico — es infraestructura de operación. <em className="text-[#e791ba]">Sin visibilidad en tiempo real, cada decisión sobre el sistema se toma con datos de semanas o meses de retraso.</em> El costo de implementación es marginal frente al costo de operar a ciegas un canal que mueve $195M anuales.
          </Callout>
        </div>
      </div>

      {/* Remate */}
      <div className="mt-8 rounded-2xl bg-[#57183c] p-5 text-[#f5f4f2] shadow-lg sm:p-10 lg:p-14">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#e791ba] mb-4">Para cerrar · El argumento más importante</div>
        <h2 className="mb-4 font-serif text-2xl font-bold leading-[1.1] sm:text-4xl">9,213 personas pagaron su refrendo.<br/>Nunca recibieron su tarjeta de circulación.</h2>
        <p className="text-[13.5px] text-[#c3caa8] leading-[1.8] max-w-2xl mb-5">Esto no es un problema de recaudación — es un problema de confianza. Y la confianza es el activo más escaso y más difícil de recuperar cuando se trata de adopción de servicios digitales de gobierno.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-white/10 border border-white/10 rounded-md overflow-hidden my-6">
          <div className="bg-white/5 p-6">
            <div className="font-mono text-[9px] tracking-[0.13em] uppercase text-[#869581] mb-2">Autos afectados</div>
            <div className="font-serif text-3xl font-bold text-[#f5f4f2]">9,213</div>
            <div className="text-[11px] text-[#869581] mt-2">pagaron · <code className="bg-white/10 px-1 rounded">completed_payments_count &gt; 0</code> · status in_progress</div>
          </div>
          <div className="bg-white/5 p-6">
            <div className="font-mono text-[9px] tracking-[0.13em] uppercase text-[#869581] mb-2">Ya cobrado, sin servicio</div>
            <div className="font-serif text-3xl font-bold text-[#ff9a9a]">$9.04M</div>
            <div className="text-[11px] text-[#869581] mt-2">obligación de entregar el refrendo ya existe</div>
          </div>
          <div className="bg-white/5 p-6">
            <div className="font-mono text-[9px] tracking-[0.13em] uppercase text-[#869581] mb-2">Tiempo de espera mediano</div>
            <div className="font-serif text-3xl font-bold text-[#ff9a9a]">66 días</div>
            <div className="text-[11px] text-[#869581] mt-2">máximo: 116 días · 2,061 esperan más de 90 días</div>
          </div>
        </div>

        <div className="mt-8">
          <div className="font-mono text-[9.5px] tracking-[0.12em] uppercase text-[#869581] mb-3">Donde está atascado el trámite de cada uno</div>
          
          <div className="flex flex-wrap items-center gap-2 py-3 text-[12px] text-[#c3caa8] border-b border-white/5 sm:flex-nowrap sm:gap-3 sm:py-2 sm:text-[12.5px]">
            <div className="font-serif text-lg font-bold text-[#f5f4f2] min-w-[60px]">4,944</div>
            <div className="flex-1">Paso "Pago" — el sistema los registró como pagados pero no avanzó el flujo</div>
            <div className="order-4 h-1 w-full rounded-full bg-white/10 sm:order-none sm:flex-1"><div className="h-full bg-[#e791ba] rounded-full" style={{ width: '100%' }}></div></div>
            <div className="font-mono text-[11px] text-[#e791ba] min-w-[60px] text-right">$4.35M</div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 py-3 text-[12px] text-[#c3caa8] border-b border-white/5 sm:flex-nowrap sm:gap-3 sm:py-2 sm:text-[12.5px]">
            <div className="font-serif text-lg font-bold text-[#f5f4f2] min-w-[60px]">2,913</div>
            <div className="flex-1">Registro del refrendo — pagaron, el registro falló en el padrón</div>
            <div className="order-4 h-1 w-full rounded-full bg-white/10 sm:order-none sm:flex-1"><div className="h-full bg-[#e791ba] rounded-full" style={{ width: '59%' }}></div></div>
            <div className="font-mono text-[11px] text-[#e791ba] min-w-[60px] text-right">$2.56M</div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 py-3 text-[12px] text-[#c3caa8] border-b border-white/5 sm:flex-nowrap sm:gap-3 sm:py-2 sm:text-[12.5px]">
            <div className="font-serif text-lg font-bold text-[#f5f4f2] min-w-[60px]">872</div>
            <div className="flex-1">Obtener tarjeta de circulación — pagaron, el PDF no se generó</div>
            <div className="order-4 h-1 w-full rounded-full bg-white/10 sm:order-none sm:flex-1"><div className="h-full bg-[#e791ba] rounded-full" style={{ width: '18%' }}></div></div>
            <div className="font-mono text-[11px] text-[#e791ba] min-w-[60px] text-right">$0.77M</div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 py-3 text-[12px] text-[#ff9a9a] sm:flex-nowrap sm:gap-3 sm:py-2 sm:text-[12.5px]">
            <div className="font-serif text-lg font-bold text-[#f5f4f2] min-w-[60px]">514</div>
            <div className="flex-1">Versión v3.0.0 — el sistema actual también tiene este patrón activo</div>
            <div className="order-4 h-1 w-full rounded-full bg-white/10 sm:order-none sm:flex-1"><div className="h-full bg-[#ff9a9a] rounded-full" style={{ width: '10%' }}></div></div>
            <div className="font-mono text-[11px] min-w-[60px] text-right">activo hoy</div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded p-5 sm:p-6 mt-8">
          <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#869581] mb-2.5">Propuesta concreta</div>
          <p className="text-[13px] text-[#c3caa8] leading-[1.7] m-0">Identificar los 9,213 registros, notificar proactivamente a cada ciudadano afectado con un mensaje de disculpa y el estado de resolución, y emitir el refrendo de forma manual o automatizada en un plazo máximo de 10 días hábiles. El costo operativo de resolver este problema es marginal frente al costo reputacional de dejarlo sin atención.</p>
        </div>
      </div>
    </div>
  );
};
