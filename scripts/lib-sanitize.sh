#!/usr/bin/env bash
# scripts/lib-sanitize.sh — shared sensitive-data sanitizer for the
# framework's cross-model review wrappers and any other path that
# writes task / EVIDENCE / prompt content to disk or sends it to an
# external model.
#
# Created in response to SEC-FND-001 (P1) from the framework-v3 PR
# security review: /feature-arena was writing full task blocks to /tmp
# candidate artifacts with no sanitizer, while the adversary-review /
# security-review wrappers had a sanitizer that ONLY covered secret
# patterns — not card / CVV / expiry / SSN patterns the principle
# claimed protection against. One shared library closes that gap so
# every sensitive-data-handling surface uses the same enforcement.
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib-sanitize.sh"
#   if ! sg_sanitize_scan_file "$prompt_file"; then exit 4; fi
#   if ! sg_sanitize_scan_string "$task_block"; then exit 4; fi
#
# Conventions:
#   - Functions return 0 if clean, 4 if a sensitive pattern matched.
#     Exit code 4 across the framework means "sanitization tripwire
#     fired" — the wrappers exit 4 on this code so the caller (Claude /
#     a CI gate) gets a clear signal.
#   - Functions print the matched-category name + first matching line
#     to stderr when they refuse. Callers should not redirect stderr to
#     null.
#   - The patterns deliberately err toward false positives. A blocked
#     send is recoverable (sanitize the input + retry); a leaked card
#     to a third-party model is not.

# Each pattern is `<category-label>||<egrep pattern>`. Double pipe
# delimiter so a single pipe inside a regex (alternation) does not get
# treated as a field separator. POSIX ERE (no \b / no PCRE) for
# portability across BSD grep on macOS and GNU grep on Linux.
sg_sanitize_patterns() {
  cat <<'EOF'
secret-pemkey||BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY
secret-awskey||aws_secret_access_key
secret-stripe||sk_live_[A-Za-z0-9]{16,}
secret-slack||xoxb-[0-9A-Za-z-]{20,}
secret-github||ghp_[A-Za-z0-9]{20,}
secret-password||password[[:space:]]*=[[:space:]]*[A-Za-z0-9!@#$%^&*]{8,}
secret-apikey||api[_-]?key[[:space:]]*=[[:space:]]*[A-Za-z0-9]{20,}
card-pan-visa-contig||(^|[^0-9])4[0-9]{15}([^0-9]|$)
card-pan-visa-spaced||(^|[^0-9])4[0-9]{3}[- ][0-9]{4}[- ][0-9]{4}[- ][0-9]{4}([^0-9]|$)
card-pan-mastercard-contig||(^|[^0-9])5[1-5][0-9]{14}([^0-9]|$)
card-pan-mastercard-spaced||(^|[^0-9])5[1-5][0-9]{2}[- ][0-9]{4}[- ][0-9]{4}[- ][0-9]{4}([^0-9]|$)
card-pan-amex-contig||(^|[^0-9])3[47][0-9]{13}([^0-9]|$)
card-pan-amex-spaced||(^|[^0-9])3[47][0-9]{2}[- ][0-9]{6}[- ][0-9]{5}([^0-9]|$)
card-pan-discover-contig||(^|[^0-9])6011[0-9]{12}([^0-9]|$)
card-pan-discover-spaced||(^|[^0-9])6011[- ][0-9]{4}[- ][0-9]{4}[- ][0-9]{4}([^0-9]|$)
card-pan-jcb-contig||(^|[^0-9])35[0-9]{14}([^0-9]|$)
card-pan-jcb-spaced||(^|[^0-9])35[0-9]{2}[- ][0-9]{4}[- ][0-9]{4}[- ][0-9]{4}([^0-9]|$)
card-cvv-labeled||(cvv|cvc|cv2|cid)[[:space:]]*[:=][[:space:]]*[0-9]{3,4}
card-expiry-labeled||(exp|expiry|expiration|expdate)[[:space:]]*[:=][[:space:]]*[0-9]{1,2}[[:space:]]*/[[:space:]]*[0-9]{2,4}
pii-ssn-us||(^|[^0-9])[0-9]{3}-[0-9]{2}-[0-9]{4}([^0-9]|$)
EOF
}

# sg_sanitize_scan_file <path>
# Scan a file for any sensitive pattern. Returns 0 if clean, 4 if any
# pattern matched. Prints `sanitize: blocked by <category> at file:N`
# to stderr — file path + line number + category only. We deliberately
# DO NOT print the matched line content. Per SEC-FND-005 from the
# framework-v3 PR security review: a previous version of this function
# printed the matched line with only the first matched pattern
# redacted, which could leak a secondary sensitive value on the same
# line. The user can open the cited file at that line manually if they
# need context.
sg_sanitize_scan_file() {
  local file="$1"
  if [ -z "$file" ] || [ ! -f "$file" ]; then
    printf 'sg_sanitize_scan_file: file not readable: %s\n' "$file" >&2
    return 4
  fi
  while IFS='||' read -r cat_label _ pattern; do
    [ -z "$cat_label" ] && continue
    if grep -qE "$pattern" "$file" 2>/dev/null; then
      local line_n
      line_n=$(grep -nE "$pattern" "$file" 2>/dev/null | head -1 | cut -d: -f1)
      printf 'sanitize: blocked by %s pattern at %s:%s (line content not printed; open the file at that line to inspect)\n' \
        "$cat_label" "$file" "${line_n:-?}" >&2
      return 4
    fi
  done < <(sg_sanitize_patterns)
  return 0
}

# sg_sanitize_scan_string <content>
# Scan a string for any sensitive pattern. Same return-code / stderr
# semantics as sg_sanitize_scan_file. Prints category + matched line
# number within the input only — never the matched content itself.
sg_sanitize_scan_string() {
  local content="$1"
  while IFS='||' read -r cat_label _ pattern; do
    [ -z "$cat_label" ] && continue
    if printf '%s' "$content" | grep -qE "$pattern" 2>/dev/null; then
      local line_n
      line_n=$(printf '%s' "$content" | grep -nE "$pattern" 2>/dev/null | head -1 | cut -d: -f1)
      printf 'sanitize: blocked by %s pattern at input-line:%s (line content not printed; inspect the source manually)\n' \
        "$cat_label" "${line_n:-?}" >&2
      return 4
    fi
  done < <(sg_sanitize_patterns)
  return 0
}

# Quick self-test (only runs when this file is invoked directly).
# Useful for verifying the patterns from the test harness.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  printf 'sg_sanitize_patterns:\n'
  sg_sanitize_patterns | nl -ba
  printf '\nself-test:\n'
  # Test cases. Each tuple is `<label>|<input>|<expected: block|allow>`.
  # SEC-FND-003 fix coverage: spaced + hyphenated PAN forms must block.
  #
  # Fixtures are constructed at runtime via shell concatenation so the
  # source file itself does not contain a literal contiguous PAN
  # sequence — otherwise the security-review wrapper's diff scan over
  # this very file would trip on its own test data. The concatenation
  # `"4""..."` produces the same runtime string as a single literal,
  # but the source has no 16-digit-contiguous run.
  v_contig="41""11111111111111"
  v_spaced="41""11 1111 1111 1111"
  v_hyphen="41""11-1111-1111-1111"
  m_contig="55""00000000000004"
  m_spaced="55""00 0000 0000 0004"
  a_contig="37""8282246310005"
  a_spaced="37""82 822463 10005"
  d_contig="60""11000000000004"
  d_hyphen="60""11-0000-0000-0004"
  j_contig="35""30111333300000"
  ssn_test="123""-45-6789"   # string-fragment concat, no literal SSN in source
  fixtures=(
    "visa-contig|prefix $v_contig suffix|block"
    "visa-spaced|paste me: $v_spaced thanks|block"
    "visa-hyphen|card: $v_hyphen|block"
    "mastercard-contig|num=$m_contig|block"
    "mastercard-spaced|num: $m_spaced|block"
    "amex-contig|num=$a_contig|block"
    "amex-spaced|num: $a_spaced|block"
    "discover-contig|num=$d_contig|block"
    "discover-hyphen|num: $d_hyphen|block"
    "jcb-contig|num=$j_contig|block"
    "cvv-labeled|cvv: 123|block"
    "ssn|ssn=$ssn_test|block"
    "clean|regular task description, no sensitive content|allow"
    "short-digits|order id 1234567 not a pan|allow"
  )

  failures=0
  for fx in "${fixtures[@]}"; do
    label="${fx%%|*}"
    rest="${fx#*|}"
    input="${rest%|*}"
    expected="${rest##*|}"
    if sg_sanitize_scan_string "$input" 2>/dev/null; then
      actual="allow"
    else
      actual="block"
    fi
    if [ "$actual" = "$expected" ]; then
      printf 'PASS: %s (%s)\n' "$label" "$actual"
    else
      printf 'FAIL: %s expected=%s actual=%s input=%q\n' "$label" "$expected" "$actual" "$input" >&2
      failures=$((failures + 1))
    fi
  done

  if [ "$failures" -gt 0 ]; then
    printf '\n%d self-test failure(s).\n' "$failures" >&2
    exit 1
  fi
  printf '\nAll self-tests passed.\n'
fi
