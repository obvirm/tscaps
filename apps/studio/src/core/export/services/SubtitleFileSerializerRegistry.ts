import type { SubtitleFileSerializer } from '@tscaps/engine';
import {
  AssSubtitleFileSerializer,
  SbvSubtitleFileSerializer,
  SrtSubtitleFileSerializer,
  TextSubtitleFileSerializer,
  VttSubtitleFileSerializer,
} from '@tscaps/engine';
import type { SubtitleFileFormat } from '@core/export/domain/SubtitleFileFormat';

/**
 * The serializer behind each offered format.
 *
 * Keyed exhaustively, so adding a format to the union without a
 * serializer for it fails to compile rather than at the moment a reader
 * picks it.
 */
export class SubtitleFileSerializerRegistry {
  private readonly serializers: Record<SubtitleFileFormat, SubtitleFileSerializer> = {
    srt: new SrtSubtitleFileSerializer(),
    vtt: new VttSubtitleFileSerializer(),
    ass: new AssSubtitleFileSerializer(),
    sbv: new SbvSubtitleFileSerializer(),
    txt: new TextSubtitleFileSerializer(),
  };

  get(format: SubtitleFileFormat): SubtitleFileSerializer {
    return this.serializers[format];
  }
}
