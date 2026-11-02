import { Moneda, MONEDAS } from '../comun/dinero';
import { Entidad } from '../comun/entidad';
import { asegurar } from '../comun/errores';

export type Region = 'EUROPA' | 'LATAM';

/** Identifica qué adaptador entiende el formato de datos que envía la filial. */
export type FormatoDatos = 'JSON_ES' | 'CSV_MX' | 'XML_PE' | 'CSV_DE' | 'ESTANDAR';

export interface FilialDto {
  id: string;
  codigo: string;
  nombre: string;
  pais: string;
  ciudad: string;
  region: Region;
  moneda: Moneda;
  formatoDatos: FormatoDatos;
  activa: boolean;
}

export interface DatosFilial {
  codigo: string;
  nombre: string;
  pais: string;
  ciudad: string;
  region: Region;
  moneda: Moneda;
  formatoDatos: FormatoDatos;
}

/** Filial de FinanCorp. Su código ISO de país (ES, MX, PE…) es su identificador. */
export class Filial extends Entidad<FilialDto> {
  readonly codigo: string;
  readonly nombre: string;
  readonly pais: string;
  readonly ciudad: string;
  readonly region: Region;
  readonly moneda: Moneda;
  private _formatoDatos: FormatoDatos;
  private _activa = true;

  constructor(datos: DatosFilial) {
    const codigo = datos.codigo?.trim().toUpperCase();
    asegurar(/^[A-Z]{2}$/.test(codigo ?? ''), 'El código de filial debe tener 2 letras (ISO de país).');
    asegurar(datos.nombre?.trim().length >= 3, 'El nombre de la filial es obligatorio.');
    asegurar(MONEDAS.includes(datos.moneda), `Moneda no soportada: ${datos.moneda}`);
    super(codigo);
    this.codigo = codigo;
    this.nombre = datos.nombre.trim();
    this.pais = datos.pais.trim();
    this.ciudad = datos.ciudad.trim();
    this.region = datos.region;
    this.moneda = datos.moneda;
    this._formatoDatos = datos.formatoDatos;
  }

  get activa(): boolean {
    return this._activa;
  }

  get formatoDatos(): FormatoDatos {
    return this._formatoDatos;
  }

  cambiarFormato(formato: FormatoDatos): void {
    this._formatoDatos = formato;
  }

  desactivar(): void {
    this._activa = false;
  }

  activar(): void {
    this._activa = true;
  }

  aDto(): FilialDto {
    return {
      id: this.id,
      codigo: this.codigo,
      nombre: this.nombre,
      pais: this.pais,
      ciudad: this.ciudad,
      region: this.region,
      moneda: this.moneda,
      formatoDatos: this._formatoDatos,
      activa: this._activa,
    };
  }
}
