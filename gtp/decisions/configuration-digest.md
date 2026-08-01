## 未決定事項

Exit Criteriaが、どの設定を評価した結果かを、外部サービスなしで機械的に識別可能にするか。

## 採用した手段

Exit Criteriaは、実際に評価する全criteriaについて既定値を展開し、criterion ID順に並べた`version`、`id`、`text`、`argv`、`cwd`、`timeout_seconds`のJSONをRFC 8785 JSON Canonicalization SchemeでUTF-8 bytesへ変換し、SHA-256へ入力する。reportにはalgorithmを含むlowercase hexadecimalの`sha256:<digest>`形式で`config_digest`を出す。YAMLのコメント、空白、mappingの記述順はdigestへ含めない。

`config_digest`が識別するのは正規化済みの実効manifestだけとする。repository root、config path、
`PATH`を含む環境変数、解決後の実行file、checker bytes、Exit Criteriaのrevision、profile release、
artifact bytesまたはrevision、reportの真正性は含めない。これらのidentityとreportを結び付ける
必要がある場合はcallerが別に記録する。Exit Criteria coreはartifact bindingやattestationを
作らない。

## 変更履歴

- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、同じdigestでも実行環境や
  実行対象が変わり得る範囲を明示し、digestをartifact identityまたは
  attestationとして扱わない境界を固定した。
