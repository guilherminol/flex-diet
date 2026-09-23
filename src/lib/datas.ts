import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

// timezone depende de utc (docs day.js.org/docs/en/plugin/timezone)
dayjs.extend(utc);
dayjs.extend(timezone);

/** Fuso do usuário — offset fixo −03 (DST abolido em 2019). */
export const FUSO = "America/Sao_Paulo";

/** Momento atual em ISO-8601 UTC — fonte da verdade de "quando" (timestamp_utc). */
export const agoraIsoUtc = (): string => new Date().toISOString();

/** Converte um instante ISO para a data local YYYY-MM-DD em America/Sao_Paulo. */
export const dataLocalSp = (iso: string): string =>
  dayjs(iso).tz(FUSO).format("YYYY-MM-DD");

/** Data local de hoje (YYYY-MM-DD) em America/Sao_Paulo. */
export const hojeLocalSp = (): string => dayjs().tz(FUSO).format("YYYY-MM-DD");

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Data informada não está no formato YYYY-MM-DD. */
export class DataInvalidaError extends Error {
  readonly codigo = "data_invalida";
  constructor(data: string) {
    super(`data inválida: "${data}" — informe no formato YYYY-MM-DD`);
    this.name = "DataInvalidaError";
  }
}

/**
 * Resolve a data local a usar: se `data` foi informada (YYYY-MM-DD), valida e
 * usa como está (registro retroativo — REG-05); se ausente, hoje em SP.
 */
export const resolverDataLocal = (data?: string): string => {
  if (data === undefined || data === "") return hojeLocalSp();
  if (!REGEX_DATA.test(data)) throw new DataInvalidaError(data);
  return data;
};
