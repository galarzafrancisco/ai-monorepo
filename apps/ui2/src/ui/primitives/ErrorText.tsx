import type { TextProps } from "./Text";
import { Text } from "./Text";
import './ErrorText.css';

export function ErrorText(props: TextProps) {
  const { children } = props;
  return (
    <div className="error--container">
      <Text
        size={props.size}
        weight={props.weight}
        tone={props.tone}
        as={props.as}
        wrap={props.wrap}
        className="error--text">
          {children}
        </Text>
    </div>
  )
}